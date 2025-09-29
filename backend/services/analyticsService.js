const db = require('../config/database');

const generateAnalytics = async (recruiterId, dateFrom, dateTo) => {
    const params = [recruiterId];
    let dateFilter = '';
    
    if (dateFrom && dateTo) {
        dateFilter = ' AND c.created_at BETWEEN $2 AND $3';
        params.push(dateFrom, dateTo);
    }
    
    // Aggregate statistics
    const stats = await db.query(`
        SELECT 
            COUNT(DISTINCT c.id) as total_candidates,
            COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN c.id END) as completed_assessments,
            AVG(EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 60) as avg_completion_time_minutes,
            AVG(a.completion_percentage) as avg_completion_rate
        FROM candidates c
        LEFT JOIN assessments a ON a.candidate_id = c.id
        WHERE c.recruiter_id = $1 ${dateFilter}
    `, params);
    
    // Dimensional averages
    const dimensionalAverages = await db.query(`
        SELECT 
            ds.dimension,
            AVG(ds.score) as avg_score,
            MIN(ds.score) as min_score,
            MAX(ds.score) as max_score,
            STDDEV(ds.score) as std_dev,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ds.score) as median
        FROM dimension_scores ds
        JOIN assessments a ON a.id = ds.assessment_id
        JOIN candidates c ON c.id = a.candidate_id
        WHERE c.recruiter_id = $1 ${dateFilter}
        GROUP BY ds.dimension
    `, params);
    
    // Top performers (top 20% by average score)
    const topPerformers = await db.query(`
        WITH candidate_scores AS (
            SELECT 
                c.id,
                c.first_name,
                c.last_name,
                c.email,
                AVG(ds.score) as avg_score
            FROM candidates c
            JOIN assessments a ON a.candidate_id = c.id
            JOIN dimension_scores ds ON ds.assessment_id = a.id
            WHERE c.recruiter_id = $1 AND a.status = 'completed' ${dateFilter}
            GROUP BY c.id
        )
        SELECT * FROM candidate_scores
        WHERE avg_score >= (SELECT PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY avg_score) FROM candidate_scores)
        ORDER BY avg_score DESC
        LIMIT 10
    `, params);
    
    // Framework distribution
    const frameworkDistribution = await db.query(`
        SELECT 
            fm.framework,
            fm.result,
            COUNT(*) as count
        FROM framework_mappings fm
        JOIN assessments a ON a.id = fm.assessment_id
        JOIN candidates c ON c.id = a.candidate_id
        WHERE c.recruiter_id = $1 ${dateFilter}
        GROUP BY fm.framework, fm.result
        ORDER BY fm.framework, count DESC
    `, params);
    
    // Time-based trends
    const trends = await db.query(`
        SELECT 
            DATE_TRUNC('week', c.created_at) as week,
            COUNT(DISTINCT c.id) as candidates,
            COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as completions
        FROM candidates c
        LEFT JOIN assessments a ON a.candidate_id = c.id
        WHERE c.recruiter_id = $1 ${dateFilter}
        GROUP BY week
        ORDER BY week
    `, params);
    
    // Red flags (bottom 20% on critical dimensions)
    const redFlags = await db.query(`
        WITH low_scores AS (
            SELECT 
                c.id,
                c.first_name,
                c.last_name,
                ds.dimension,
                ds.score
            FROM candidates c
            JOIN assessments a ON a.candidate_id = c.id
            JOIN dimension_scores ds ON ds.assessment_id = a.id
            WHERE c.recruiter_id = $1 
                AND ds.dimension IN ('ethical_reasoning', 'emotional_regulation', 'self_management')
                AND ds.score < 40 ${dateFilter}
        )
        SELECT * FROM low_scores
        ORDER BY score ASC
        LIMIT 10
    `, params);
    
    return {
        summary: stats.rows[0],
        dimensionalAverages: dimensionalAverages.rows,
        topPerformers: topPerformers.rows,
        frameworkDistribution: frameworkDistribution.rows,
        trends: trends.rows,
        redFlags: redFlags.rows
    };
};

const generateComparisonInsights = async (candidates) => {
    const insights = {
        strengths: [],
        differences: [],
        recommendations: []
    };
    
    // Find common strengths
    const allScores = candidates.map(c => c.scores).flat();
    const dimensionAverages = {};
    
    allScores.forEach(score => {
        if (!dimensionAverages[score.dimension]) {
            dimensionAverages[score.dimension] = [];
        }
        dimensionAverages[score.dimension].push(score.score);
    });
    
    // Identify shared strengths (all candidates score > 70)
    Object.entries(dimensionAverages).forEach(([dimension, scores]) => {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const min = Math.min(...scores);
        
        if (min > 70) {
            insights.strengths.push({
                dimension,
                averageScore: avg,
                description: `All candidates show strong ${dimension.replace(/_/g, ' ')}`
            });
        }
    });
    
    // Identify major differences (variance > 30 points)
    Object.entries(dimensionAverages).forEach(([dimension, scores]) => {
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        const variance = max - min;
        
        if (variance > 30) {
            insights.differences.push({
                dimension,
                variance,
                range: { min, max },
                description: `Significant variation in ${dimension.replace(/_/g, ' ')}`
            });
        }
    });
    
    // Generate recommendations
    if (insights.strengths.length > 0) {
        insights.recommendations.push({
            type: 'team_composition',
            message: 'These candidates share strong competencies that could form a solid team foundation'
        });
    }
    
    if (insights.differences.length > 0) {
        insights.recommendations.push({
            type: 'complementary_skills',
            message: 'The variation in skills suggests these candidates could complement each other well'
        });
    }
    
    // Cultural fit analysis
    const culturalDimensions = ['ethical_reasoning', 'collaborative_intelligence', 'relationship_building'];
    const culturalScores = {};
    
    candidates.forEach((candidate, index) => {
        culturalScores[`candidate_${index + 1}`] = candidate.scores
            .filter(s => culturalDimensions.includes(s.dimension))
            .reduce((sum, s) => sum + s.score, 0) / culturalDimensions.length;
    });
    
    insights.culturalFit = culturalScores;
    
    return insights;
};

module.exports = {
    generateAnalytics,
    generateComparisonInsights
};
