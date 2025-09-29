const db = require('../config/database');
const analyticsService = require('../services/analyticsService');

const getDashboardOverview = async (req, res) => {
    try {
        const recruiterId = req.user.userId;
        
        // Get stats
        const stats = await db.query(`
            SELECT 
                COUNT(DISTINCT c.id) as total_candidates,
                COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN c.id END) as completed_assessments,
                COUNT(DISTINCT CASE WHEN a.status = 'in_progress' THEN c.id END) as in_progress,
                COUNT(DISTINCT CASE WHEN DATE(c.created_at) = CURRENT_DATE THEN c.id END) as today_candidates
            FROM candidates c
            LEFT JOIN assessments a ON a.candidate_id = c.id
            WHERE c.recruiter_id = $1
        `, [recruiterId]);
        
        // Get recent candidates
        const recentCandidates = await db.query(`
            SELECT 
                c.*,
                a.status as assessment_status,
                a.completion_percentage,
                a.start_time,
                a.end_time
            FROM candidates c
            LEFT JOIN assessments a ON a.candidate_id = c.id
            WHERE c.recruiter_id = $1
            ORDER BY c.created_at DESC
            LIMIT 10
        `, [recruiterId]);
        
        // Get notifications
        const notifications = await db.query(`
            SELECT * FROM notifications 
            WHERE recruiter_id = $1 AND read = false
            ORDER BY created_at DESC
            LIMIT 5
        `, [recruiterId]);
        
        res.json({
            stats: stats.rows[0],
            recentCandidates: recentCandidates.rows,
            notifications: notifications.rows
        });
    } catch (error) {
        console.error('Dashboard overview error:', error);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
};

const getCandidates = async (req, res) => {
    try {
        const recruiterId = req.user.userId;
        const { status, search, sortBy = 'created_at', order = 'DESC' } = req.query;
        
        let query = `
            SELECT 
                c.*,
                a.id as assessment_id,
                a.status as assessment_status,
                a.completion_percentage,
                a.start_time,
                a.end_time,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'dimension', ds.dimension,
                            'score', ds.score,
                            'percentile', ds.percentile
                        )
                    ) FILTER (WHERE ds.dimension IS NOT NULL),
                    '[]'
                ) as dimension_scores
            FROM candidates c
            LEFT JOIN assessments a ON a.candidate_id = c.id
            LEFT JOIN dimension_scores ds ON ds.assessment_id = a.id
            WHERE c.recruiter_id = $1
        `;
        
        const params = [recruiterId];
        let paramIndex = 2;
        
        if (status) {
            query += ` AND a.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        
        if (search) {
            query += ` AND (c.first_name ILIKE $${paramIndex} OR c.last_name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        
        query += ` GROUP BY c.id, a.id ORDER BY ${sortBy} ${order}`;
        
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get candidates error:', error);
        res.status(500).json({ error: 'Failed to get candidates' });
    }
};

const getCandidateDetail = async (req, res) => {
    try {
        const { candidateId } = req.params;
        const recruiterId = req.user.userId;
        
        // Get candidate info
        const candidate = await db.query(
            `SELECT * FROM candidates WHERE id = $1 AND recruiter_id = $2`,
            [candidateId, recruiterId]
        );
        
        if (candidate.rows.length === 0) {
            return res.status(404).json({ error: 'Candidate not found' });
        }
        
        // Get assessment info
        const assessment = await db.query(
            `SELECT * FROM assessments WHERE candidate_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [candidateId]
        );
        
        let responseData = {};
        
        if (assessment.rows.length > 0) {
            const assessmentId = assessment.rows[0].id;
            
            // Get all responses
            const responses = await db.query(
                `SELECT * FROM responses WHERE assessment_id = $1 ORDER BY created_at`,
                [assessmentId]
            );
            
            // Get dimensional scores
            const scores = await db.query(
                `SELECT * FROM dimension_scores WHERE assessment_id = $1`,
                [assessmentId]
            );
            
            // Get framework mappings
            const mappings = await db.query(
                `SELECT * FROM framework_mappings WHERE assessment_id = $1`,
                [assessmentId]
            );
            
            responseData = {
                assessment: assessment.rows[0],
                responses: responses.rows,
                dimensionalScores: scores.rows,
                frameworkMappings: mappings.rows
            };
        }
        
        res.json({
            candidate: candidate.rows[0],
            ...responseData
        });
    } catch (error) {
        console.error('Get candidate detail error:', error);
        res.status(500).json({ error: 'Failed to get candidate details' });
    }
};

const compareCandidates = async (req, res) => {
    try {
        const { candidateIds } = req.body;
        const recruiterId = req.user.userId;
        
        if (!candidateIds || candidateIds.length < 2) {
            return res.status(400).json({ error: 'At least 2 candidates required for comparison' });
        }
        
        const comparisonData = await Promise.all(
            candidateIds.map(async (candidateId) => {
                // Get candidate info
                const candidate = await db.query(
                    `SELECT * FROM candidates WHERE id = $1 AND recruiter_id = $2`,
                    [candidateId, recruiterId]
                );
                
                if (candidate.rows.length === 0) {
                    return null;
                }
                
                // Get latest assessment
                const assessment = await db.query(
                    `SELECT * FROM assessments WHERE candidate_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT 1`,
                    [candidateId]
                );
                
                if (assessment.rows.length === 0) {
                    return {
                        candidate: candidate.rows[0],
                        scores: [],
                        mappings: []
                    };
                }
                
                // Get scores
                const scores = await db.query(
                    `SELECT * FROM dimension_scores WHERE assessment_id = $1`,
                    [assessment.rows[0].id]
                );
                
                // Get mappings
                const mappings = await db.query(
                    `SELECT * FROM framework_mappings WHERE assessment_id = $1`,
                    [assessment.rows[0].id]
                );
                
                return {
                    candidate: candidate.rows[0],
                    assessment: assessment.rows[0],
                    scores: scores.rows,
                    mappings: mappings.rows
                };
            })
        );
        
        // Filter out nulls and generate comparison insights
        const validComparisons = comparisonData.filter(c => c !== null);
        const insights = await analyticsService.generateComparisonInsights(validComparisons);
        
        res.json({
            candidates: validComparisons,
            insights
        });
    } catch (error) {
        console.error('Compare candidates error:', error);
        res.status(500).json({ error: 'Failed to compare candidates' });
    }
};

const getAnalytics = async (req, res) => {
    try {
        const recruiterId = req.user.userId;
        const { dateFrom, dateTo } = req.query;
        
        const analytics = await analyticsService.generateAnalytics(
            recruiterId,
            dateFrom,
            dateTo
        );
        
        res.json(analytics);
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
};

module.exports = {
    getDashboardOverview,
    getCandidates,
    getCandidateDetail,
    compareCandidates,
    getAnalytics
};
