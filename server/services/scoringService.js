const db = require('../config/database');

// The 12 dimensions from Phase 1
const DIMENSIONS = [
    'cognitive_flexibility',
    'emotional_regulation',
    'social_calibration',
    'achievement_drive',
    'learning_orientation',
    'risk_tolerance',
    'relationship_building',
    'ethical_reasoning',
    'influence_style',
    'systems_thinking',
    'self_management',
    'collaborative_intelligence'
];

const calculateDimensionalScores = async (assessmentId, responses) => {
    const dimensionScores = {};
    
    // Initialize scores
    DIMENSIONS.forEach(dimension => {
        dimensionScores[dimension] = {
            totalScore: 0,
            responseCount: 0,
            weightedScore: 0
        };
    });
    
    // Process each response
    for (const response of responses) {
        const responseData = typeof response.response_data === 'string' 
            ? JSON.parse(response.response_data) 
            : response.response_data;
        
        // Calculate scores based on question type
        const scores = calculateQuestionScores(
            response.question_type,
            responseData
        );
        
        // Add to dimension totals
        Object.entries(scores).forEach(([dimension, score]) => {
            if (dimensionScores[dimension]) {
                dimensionScores[dimension].totalScore += score;
                dimensionScores[dimension].responseCount += 1;
            }
        });
    }
    
    // Calculate final scores and save to database
    const finalScores = [];
    
    for (const [dimension, data] of Object.entries(dimensionScores)) {
        if (data.responseCount > 0) {
            const averageScore = data.totalScore / data.responseCount;
            const normalizedScore = Math.min(100, Math.max(0, averageScore));
            
            // Calculate percentile (simplified - in production, compare against benchmarks)
            const percentile = calculatePercentile(normalizedScore);
            
            // Save to database
            await db.query(
                `INSERT INTO dimension_scores 
                 (assessment_id, dimension, score, percentile) 
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (assessment_id, dimension) 
                 DO UPDATE SET score = $3, percentile = $4`,
                [assessmentId, dimension, normalizedScore, percentile]
            );
            
            finalScores.push({
                dimension,
                score: normalizedScore,
                percentile
            });
        }
    }
    
    return finalScores;
};

const calculateQuestionScores = (questionType, responseData) => {
    const scores = {};
    
    switch (questionType) {
        case 'likert_grid':
            // Process Likert grid responses
            if (responseData.responses) {
                Object.entries(responseData.responses).forEach(([item, value]) => {
                    const dimension = mapItemToDimension(item);
                    scores[dimension] = (scores[dimension] || 0) + (value * 20);
                });
            }
            break;
            
        case 'sliding_spectrum':
            // Process spectrum responses
            if (responseData.positions) {
                Object.entries(responseData.positions).forEach(([spectrum, position]) => {
                    const dimension = mapSpectrumToDimension(spectrum);
                    scores[dimension] = position;
                });
            }
            break;
            
        case 'priority_matrix':
            // Process priority matrix
            if (responseData.quadrants) {
                processMatrixQuadrants(responseData.quadrants, scores);
            }
            break;
            
        case 'speed_ranking':
            // Process speed ranking
            if (responseData.rankings) {
                processRankings(responseData.rankings, scores);
            }
            break;
            
        case 'word_cloud':
            // Process word cloud selections
            if (responseData.selected) {
                responseData.selected.forEach(word => {
                    const dimension = mapWordToDimension(word);
                    scores[dimension] = (scores[dimension] || 0) + 25;
                });
            }
            break;
            
        case 'emoji_reaction':
            // Process emoji reactions
            if (responseData.reactions) {
                Object.entries(responseData.reactions).forEach(([scenario, emoji]) => {
                    const dimension = mapEmojiToDimension(scenario, emoji);
                    scores[dimension] = (scores[dimension] || 0) + 30;
                });
            }
            break;
            
        case 'percentage_allocator':
            // Process percentage allocations
            if (responseData.allocations) {
                Object.entries(responseData.allocations).forEach(([category, percentage]) => {
                    const dimension = mapCategoryToDimension(category);
                    scores[dimension] = percentage;
                });
            }
            break;
            
        case 'two_pile_sort':
            // Process two-pile sort
            if (responseData.energizing && responseData.draining) {
                responseData.energizing.forEach(item => {
                    const dimension = mapActivityToDimension(item);
                    scores[dimension] = (scores[dimension] || 0) + 20;
                });
                responseData.draining.forEach(item => {
                    const dimension = mapActivityToDimension(item);
                    scores[dimension] = (scores[dimension] || 0) - 10;
                });
            }
            break;
    }
    
    return scores;
};

// Mapping functions (simplified - extend based on your question bank)
const mapItemToDimension = (item) => {
    const mappings = {
        'adaptability': 'cognitive_flexibility',
        'stress_handling': 'emotional_regulation',
        'teamwork': 'collaborative_intelligence',
        'goal_orientation': 'achievement_drive',
        'learning': 'learning_orientation',
        'risk_taking': 'risk_tolerance',
        'networking': 'relationship_building',
        'integrity': 'ethical_reasoning',
        'leadership': 'influence_style',
        'problem_solving': 'systems_thinking',
        'organization': 'self_management',
        'empathy': 'social_calibration'
    };
    
    return mappings[item.toLowerCase()] || 'cognitive_flexibility';
};

const mapSpectrumToDimension = (spectrum) => {
    const mappings = {
        'introvert_extrovert': 'social_calibration',
        'detail_big_picture': 'systems_thinking',
        'planned_spontaneous': 'self_management',
        'logical_emotional': 'emotional_regulation',
        'independent_collaborative': 'collaborative_intelligence',
        'cautious_adventurous': 'risk_tolerance'
    };
    
    return mappings[spectrum] || 'cognitive_flexibility';
};

const mapWordToDimension = (word) => {
    // Implement based on your word cloud options
    const wordMappings = {
        'innovative': 'cognitive_flexibility',
        'analytical': 'systems_thinking',
        'empathetic': 'social_calibration',
        'driven': 'achievement_drive',
        'curious': 'learning_orientation',
        'bold': 'risk_tolerance',
        'collaborative': 'collaborative_intelligence',
        'organized': 'self_management',
        'ethical': 'ethical_reasoning',
        'influential': 'influence_style',
        'calm': 'emotional_regulation',
        'supportive': 'relationship_building'
    };
    
    return wordMappings[word.toLowerCase()] || 'cognitive_flexibility';
};

const mapEmojiToDimension = (scenario, emoji) => {
    // Map based on scenario and emoji combination
    // This is simplified - extend based on your scenarios
    if (emoji === '😊' || emoji === '😄') {
        return 'emotional_regulation';
    } else if (emoji === '🤔' || emoji === '🧐') {
        return 'cognitive_flexibility';
    } else if (emoji === '😤' || emoji === '😠') {
        return 'achievement_drive';
    } else if (emoji === '🤝' || emoji === '👥') {
        return 'collaborative_intelligence';
    }
    
    return 'social_calibration';
};

const mapCategoryToDimension = (category) => {
    const categoryMappings = {
        'innovation': 'cognitive_flexibility',
        'stability': 'self_management',
        'growth': 'learning_orientation',
        'relationships': 'relationship_building',
        'achievement': 'achievement_drive',
        'adventure': 'risk_tolerance'
    };
    
    return categoryMappings[category.toLowerCase()] || 'cognitive_flexibility';
};

const mapActivityToDimension = (activity) => {
    const activityMappings = {
        'brainstorming': 'cognitive_flexibility',
        'organizing': 'self_management',
        'networking': 'relationship_building',
        'competing': 'achievement_drive',
        'learning': 'learning_orientation',
        'exploring': 'risk_tolerance',
        'collaborating': 'collaborative_intelligence',
        'analyzing': 'systems_thinking',
        'mentoring': 'influence_style',
        'mediating': 'social_calibration'
    };
    
    return activityMappings[activity.toLowerCase()] || 'cognitive_flexibility';
};

const processMatrixQuadrants = (quadrants, scores) => {
    // Urgent & Important
    if (quadrants.urgent_important) {
        quadrants.urgent_important.forEach(item => {
            scores['achievement_drive'] = (scores['achievement_drive'] || 0) + 25;
            scores['self_management'] = (scores['self_management'] || 0) + 20;
        });
    }
    
    // Not Urgent & Important
    if (quadrants.not_urgent_important) {
        quadrants.not_urgent_important.forEach(item => {
            scores['systems_thinking'] = (scores['systems_thinking'] || 0) + 25;
            scores['learning_orientation'] = (scores['learning_orientation'] || 0) + 20;
        });
    }
    
    // Urgent & Not Important
    if (quadrants.urgent_not_important) {
        quadrants.urgent_not_important.forEach(item => {
            scores['emotional_regulation'] = (scores['emotional_regulation'] || 0) + 15;
        });
    }
    
    // Not Urgent & Not Important
    if (quadrants.not_urgent_not_important) {
        quadrants.not_urgent_not_important.forEach(item => {
            scores['self_management'] = (scores['self_management'] || 0) - 10;
        });
    }
};

const processRankings = (rankings, scores) => {
    rankings.forEach((item, index) => {
        const dimension = mapItemToDimension(item);
        // Higher ranking (lower index) = higher score
        const score = (5 - index) * 20;
        scores[dimension] = (scores[dimension] || 0) + score;
    });
};

const calculatePercentile = (score) => {
    // Simplified percentile calculation
    // In production, compare against actual population data
    if (score >= 90) return 95;
    if (score >= 80) return 85;
    if (score >= 70) return 70;
    if (score >= 60) return 50;
    if (score >= 50) return 30;
    if (score >= 40) return 15;
    return 5;
};

const generateFrameworkMappings = async (assessmentId, dimensionalScores) => {
    const mappings = [];
    
    // MBTI Mapping
    const mbti = calculateMBTI(dimensionalScores);
    mappings.push({
        framework: 'MBTI',
        result: mbti.type,
        confidence: mbti.confidence,
        details: mbti.details
    });
    
    // Big Five Mapping
    const bigFive = calculateBigFive(dimensionalScores);
    mappings.push({
        framework: 'Big Five',
        result: bigFive.summary,
        confidence: bigFive.confidence,
        details: bigFive.scores
    });
    
    // DISC Mapping
    const disc = calculateDISC(dimensionalScores);
    mappings.push({
        framework: 'DISC',
        result: disc.type,
        confidence: disc.confidence,
        details: disc.scores
    });
    
    // Enneagram Mapping
    const enneagram = calculateEnneagram(dimensionalScores);
    mappings.push({
        framework: 'Enneagram',
        result: `Type ${enneagram.type}`,
        confidence: enneagram.confidence,
        details: enneagram.details
    });
    
    // Save mappings to database
    for (const mapping of mappings) {
        await db.query(
            `INSERT INTO framework_mappings 
             (assessment_id, framework, result, confidence, details) 
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (assessment_id, framework) 
             DO UPDATE SET result = $3, confidence = $4, details = $5`,
            [
                assessmentId,
                mapping.framework,
                mapping.result,
                mapping.confidence,
                JSON.stringify(mapping.details)
            ]
        );
    }
    
    return mappings;
};

const calculateMBTI = (scores) => {
    const dimensions = {
        E_I: 0,  // Extraversion vs Introversion
        S_N: 0,  // Sensing vs Intuition
        T_F: 0,  // Thinking vs Feeling
        J_P: 0   // Judging vs Perceiving
    };
    
    // Map dimensional scores to MBTI dimensions
    scores.forEach(score => {
        switch (score.dimension) {
            case 'social_calibration':
            case 'relationship_building':
                dimensions.E_I += score.score > 50 ? score.score - 50 : score.score - 50;
                break;
            case 'cognitive_flexibility':
            case 'learning_orientation':
                dimensions.S_N += score.score - 50;
                break;
            case 'systems_thinking':
            case 'ethical_reasoning':
                dimensions.T_F += 50 - score.score;
                break;
            case 'self_management':
            case 'achievement_drive':
                dimensions.J_P += 50 - score.score;
                break;
        }
    });
    
    const type = 
        (dimensions.E_I > 0 ? 'E' : 'I') +
        (dimensions.S_N > 0 ? 'N' : 'S') +
        (dimensions.T_F > 0 ? 'T' : 'F') +
        (dimensions.J_P > 0 ? 'J' : 'P');
    
    const confidence = Math.min(
        Math.abs(dimensions.E_I) / 50,
        Math.abs(dimensions.S_N) / 50,
        Math.abs(dimensions.T_F) / 50,
        Math.abs(dimensions.J_P) / 50
    );
    
    return {
        type,
        confidence,
        details: dimensions
    };
};

const calculateBigFive = (scores) => {
    const bigFive = {
        openness: 0,
        conscientiousness: 0,
        extraversion: 0,
        agreeableness: 0,
        neuroticism: 0
    };
    
    scores.forEach(score => {
        switch (score.dimension) {
            case 'cognitive_flexibility':
            case 'learning_orientation':
                bigFive.openness += score.score;
                break;
            case 'self_management':
            case 'achievement_drive':
                bigFive.conscientiousness += score.score;
                break;
            case 'social_calibration':
            case 'relationship_building':
                bigFive.extraversion += score.score;
                break;
            case 'collaborative_intelligence':
            case 'ethical_reasoning':
                bigFive.agreeableness += score.score;
                break;
            case 'emotional_regulation':
                bigFive.neuroticism += (100 - score.score);
                break;
        }
    });
    
    // Normalize scores
    Object.keys(bigFive).forEach(trait => {
        bigFive[trait] = Math.round(bigFive[trait] / 2);
    });
    
    const summary = Object.entries(bigFive)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([trait]) => trait.charAt(0).toUpperCase() + trait.slice(1))
        .join('-');
    
    return {
        summary,
        confidence: 0.85,
        scores: bigFive
    };
};

const calculateDISC = (scores) => {
    const disc = {
        D: 0,  // Dominance
        I: 0,  // Influence
        S: 0,  // Steadiness
        C: 0   // Conscientiousness
    };
    
    scores.forEach(score => {
        switch (score.dimension) {
            case 'achievement_drive':
            case 'risk_tolerance':
                disc.D += score.score;
                break;
            case 'influence_style':
            case 'social_calibration':
                disc.I += score.score;
                break;
            case 'collaborative_intelligence':
            case 'relationship_building':
                disc.S += score.score;
                break;
            case 'systems_thinking':
            case 'self_management':
                disc.C += score.score;
                break;
        }
    });
    
    const dominant = Object.entries(disc)
        .sort((a, b) => b[1] - a[1])[0][0];
    
    return {
        type: dominant,
        confidence: 0.80,
        scores: disc
    };
};

const calculateEnneagram = (scores) => {
    const types = {
        1: 0,  // Perfectionist
        2: 0,  // Helper
        3: 0,  // Achiever
        4: 0,  // Individualist
        5: 0,  // Investigator
        6: 0,  // Loyalist
        7: 0,  // Enthusiast
        8: 0,  // Challenger
        9: 0   // Peacemaker
    };
    
    scores.forEach(score => {
        switch (score.dimension) {
            case 'ethical_reasoning':
            case 'self_management':
                types[1] += score.score;
                break;
            case 'relationship_building':
            case 'collaborative_intelligence':
                types[2] += score.score;
                break;
            case 'achievement_drive':
            case 'influence_style':
                types[3] += score.score;
                break;
            case 'cognitive_flexibility':
                types[4] += score.score;
                break;
            case 'systems_thinking':
            case 'learning_orientation':
                types[5] += score.score;
                break;
            case 'emotional_regulation':
                types[6] += score.score;
                break;
            case 'risk_tolerance':
                types[7] += score.score;
                break;
            case 'influence_style':
                types[8] += score.score;
                break;
            case 'social_calibration':
                types[9] += score.score;
                break;
        }
    });
    
    const dominantType = Object.entries(types)
        .sort((a, b) => b[1] - a[1])[0][0];
    
    return {
        type: dominantType,
        confidence: 0.75,
        details: types
    };
};

module.exports = {
    calculateDimensionalScores,
    generateFrameworkMappings
};
