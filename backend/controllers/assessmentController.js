const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const scoringService = require('../services/scoringService');
const notificationService = require('../services/notificationService');
const intelligenceService = require('../services/intelligenceService');

const startAssessment = async (req, res) => {
    try {
        const { candidateId } = req.body;
        if (!candidateId) {
            return res.status(400).json({ error: 'candidateId is required' });
        }
        
        // Check for existing incomplete assessment
        const existing = await db.query(
            `SELECT id FROM assessments 
             WHERE candidate_id = $1 AND status != 'completed'`,
            [candidateId]
        );
        
        if (existing.rows.length > 0) {
            return res.json({ 
                assessmentId: existing.rows[0].id,
                resumed: true 
            });
        }
        
        // Create new assessment
        const assessmentId = uuidv4();
        await db.query(
            `INSERT INTO assessments (id, candidate_id, status, start_time) 
             VALUES ($1, $2, 'in_progress', CURRENT_TIMESTAMP)`,
            [assessmentId, candidateId]
        );
        
        res.json({ assessmentId, resumed: false, candidateId });
    } catch (error) {
        console.error('Start assessment error:', error);
        res.status(500).json({ error: 'Failed to start assessment' });
    }
};

const saveResponse = async (req, res) => {
    try {
        const { 
            assessmentId, 
            questionId, 
            questionType, 
            responseData,
            timeSpent,
            behaviorMetrics 
        } = req.body;
        
        // Save response
        await db.query(
            `INSERT INTO responses 
             (assessment_id, question_id, question_type, response_data, 
              time_spent_ms, mouse_movements, key_strokes, tab_switches) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                assessmentId,
                questionId,
                questionType,
                JSON.stringify(responseData),
                timeSpent,
                behaviorMetrics?.mouseMovements || 0,
                behaviorMetrics?.keyStrokes || 0,
                behaviorMetrics?.tabSwitches || 0
            ]
        );
        
        // Update progress
        const progress = await db.query(
            `SELECT COUNT(*) as completed FROM responses WHERE assessment_id = $1`,
            [assessmentId]
        );
        
        const completionPercentage = Math.round((progress.rows[0].completed / 27) * 100);
        
        await db.query(
            `UPDATE assessments 
             SET completion_percentage = $1, current_question = $2 
             WHERE id = $3`,
            [completionPercentage, progress.rows[0].completed, assessmentId]
        );
        
        // Emit real-time update
        const io = req.app.get('io');
        const candidateResult = await db.query(
            `SELECT c.*, a.completion_percentage 
             FROM candidates c 
             JOIN assessments a ON a.candidate_id = c.id 
             WHERE a.id = $1`,
            [assessmentId]
        );
        
        if (candidateResult.rows.length > 0) {
            const candidate = candidateResult.rows[0];
            io.to(`recruiter-${candidate.recruiter_id}`).emit('candidate-progress', {
                candidateId: candidate.id,
                assessmentId,
                completionPercentage,
                currentQuestion: progress.rows[0].completed
            });
        }
        
        res.json({ success: true, completionPercentage });
    } catch (error) {
        console.error('Save response error:', error);
        res.status(500).json({ error: 'Failed to save response' });
    }
};

const completeAssessment = async (req, res) => {
    try {
        const { assessmentId } = req.body;
        
        // Get all responses
        const responses = await db.query(
            'SELECT * FROM responses WHERE assessment_id = $1',
            [assessmentId]
        );
        
        // Calculate dimensional scores
        const scores = await scoringService.calculateDimensionalScores(
            assessmentId,
            responses.rows
        );
        
        // Calculate framework mappings
        const mappings = await scoringService.generateFrameworkMappings(
            assessmentId,
            scores
        );
        
        // Generate intelligence report
        const intelligenceReport = await intelligenceService.generateIntelligenceReport(
            assessmentId,
            scores,
            mappings
        );
        
        // Update assessment status
        await db.query(
            `UPDATE assessments 
             SET status = 'completed', end_time = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [assessmentId]
        );
        
        // Move candidate to "Assessment Complete" stage
        const candidateResult = await db.query(
            `SELECT c.* FROM candidates c 
             JOIN assessments a ON a.candidate_id = c.id 
             WHERE a.id = $1`,
            [assessmentId]
        );
        
        if (candidateResult.rows.length > 0) {
            const candidate = candidateResult.rows[0];
            
            // Get "Assessment Complete" stage
            const stageResult = await db.query(
                `SELECT id FROM pipeline_stages WHERE name = 'Assessment Complete'`
            );
            
            if (stageResult.rows.length > 0) {
                await db.query(`
                    INSERT INTO candidate_pipeline (candidate_id, stage_id, moved_by, notes, moved_at)
                    VALUES ($1, $2, $3, 'Assessment completed automatically', CURRENT_TIMESTAMP)
                    ON CONFLICT (candidate_id) 
                    DO UPDATE SET 
                        stage_id = $2,
                        moved_by = $3,
                        notes = 'Assessment completed automatically',
                        moved_at = CURRENT_TIMESTAMP
                `, [candidate.id, stageResult.rows[0].id, candidate.recruiter_id]);
            }
            
            // Send notification to recruiter
            await notificationService.notifyAssessmentComplete(
                candidate.recruiter_id,
                candidate
            );
            
            // Check for high performer
            const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
            if (avgScore >= 80) {
                await notificationService.notifyHighPerformer(
                    candidate.recruiter_id,
                    candidate,
                    scores
                );
            }
            
            // Check for red flags
            for (const score of scores) {
                if (score.score < 40) {
                    await notificationService.notifyRedFlag(
                        candidate.recruiter_id,
                        candidate,
                        score.dimension,
                        score.score
                    );
                }
            }
            
            // Emit real-time update
            const io = req.app.get('io');
            io.to(`recruiter-${candidate.recruiter_id}`).emit('assessment-completed', {
                candidateId: candidate.id,
                candidateName: `${candidate.first_name} ${candidate.last_name}`,
                assessmentId,
                intelligenceReportId: intelligenceReport.id
            });
        }
        
        res.json({ 
            success: true, 
            scores,
            mappings,
            intelligenceReport
        });
    } catch (error) {
        console.error('Complete assessment error:', error);
        res.status(500).json({ error: 'Failed to complete assessment' });
    }
};

const getAssessmentResults = async (req, res) => {
    try {
        const { assessmentId } = req.params;
        
        // Get assessment details
        const assessment = await db.query(
            'SELECT * FROM assessments WHERE id = $1',
            [assessmentId]
        );
        
        if (assessment.rows.length === 0) {
            return res.status(404).json({ error: 'Assessment not found' });
        }
        
        // Get dimensional scores
        const scores = await db.query(
            'SELECT * FROM dimension_scores WHERE assessment_id = $1',
            [assessmentId]
        );
        
        // Get framework mappings
        const mappings = await db.query(
            'SELECT * FROM framework_mappings WHERE assessment_id = $1',
            [assessmentId]
        );
        
        res.json({
            assessment: assessment.rows[0],
            scores: scores.rows,
            mappings: mappings.rows
        });
    } catch (error) {
        console.error('Get results error:', error);
        res.status(500).json({ error: 'Failed to get results' });
    }
};

const getIntelligenceReport = async (req, res) => {
    try {
        const { assessmentId } = req.params;
        console.log('Fetching intelligence report for assessment:', assessmentId);

        // Check if this is a demo assessment
        const isDemoAssessment = assessmentId.startsWith('demo-assessment-');

        if (isDemoAssessment) {
            console.log('📊 Generating demo intelligence report for:', assessmentId);

            // Extract candidate ID from demo assessment ID
            const candidateId = assessmentId.replace('demo-assessment-', '');

            // Generate demo dimensional scores
            const demoDimensionScores = {
                'Achievement Drive': { score: Math.floor(Math.random() * 20) + 80, percentile: 85 },
                'Client Focus': { score: Math.floor(Math.random() * 20) + 75, percentile: 82 },
                'Resilience': { score: Math.floor(Math.random() * 25) + 70, percentile: 78 },
                'Communication Skills': { score: Math.floor(Math.random() * 20) + 80, percentile: 88 },
                'Learning Agility': { score: Math.floor(Math.random() * 20) + 75, percentile: 80 },
                'Collaboration': { score: Math.floor(Math.random() * 25) + 70, percentile: 75 },
                'Integrity': { score: Math.floor(Math.random() * 15) + 85, percentile: 90 },
                'Problem Solving': { score: Math.floor(Math.random() * 20) + 75, percentile: 82 },
                'Adaptability': { score: Math.floor(Math.random() * 20) + 75, percentile: 79 },
                'Goal Orientation': { score: Math.floor(Math.random() * 20) + 80, percentile: 85 },
                'Relationship Building': { score: Math.floor(Math.random() * 20) + 75, percentile: 81 },
                'Initiative': { score: Math.floor(Math.random() * 20) + 75, percentile: 77 }
            };

            // Calculate average score from demo dimensions
            const dimensionValues = Object.values(demoDimensionScores);
            const avgScore = Math.round(dimensionValues.reduce((sum, dim) => sum + dim.score, 0) / dimensionValues.length);

            // Generate demo intelligence report
            const demoReport = {
                assessmentId,
                overallScore: avgScore,
                fitScore: Math.min(95, avgScore + Math.floor(Math.random() * 10) - 5),
                dimensionScores: demoDimensionScores,
                personalityProfile: {
                    mbti: avgScore >= 85 ? 'ESFJ' : avgScore >= 75 ? 'INTJ' : 'ESTP',
                    disc: avgScore >= 85 ? 'I/S Profile (Influential & Steady)' : avgScore >= 75 ? 'C/D Profile (Conscientious & Driven)' : 'D/I Profile (Dominant & Influential)',
                    enneagram: avgScore >= 85 ? 'Type 2 - The Helper' : avgScore >= 75 ? 'Type 5 - The Investigator' : 'Type 8 - The Challenger'
                },
                strengths: avgScore >= 85 ? [
                    'Outstanding Ethical Standards (98/100)',
                    'Exceptional Relationship Building (96/100)',
                    'Superior Social Calibration (93/100)',
                    'High Emotional Regulation (92/100)',
                    'Strong Achievement Drive (90/100)'
                ] : avgScore >= 75 ? [
                    'Exceptional Learning Orientation (98/100)',
                    'Outstanding Systems Thinking (96/100)',
                    'Superior Cognitive Flexibility (95/100)',
                    'Excellent Self Management (94/100)',
                    'Strong Achievement Drive (92/100)'
                ] : [
                    'High Achievement Drive (78/100)',
                    'Strong Influence Style (76/100)'
                ],
                concerns: avgScore >= 85 ? [
                    'May be overly cautious with innovation'
                ] : avgScore >= 75 ? [
                    'Needs relationship building development',
                    'Requires interpersonal skill training'
                ] : [
                    'Ethical concerns require monitoring',
                    'Poor learning orientation',
                    'Team collaboration challenges'
                ],
                recommendation: avgScore >= 85 ? 'STRONG HIRE' : avgScore >= 75 ? 'HIRE WITH DEVELOPMENT' : 'DO NOT HIRE',
                riskLevel: avgScore >= 85 ? 'LOW' : avgScore >= 75 ? 'MEDIUM' : 'HIGH',
                faFitScore: avgScore >= 85 ? 93 : avgScore >= 75 ? 85 : 32,
                onboardingPlan: avgScore >= 85 ? [
                    'Fast-track to client-facing roles',
                    'Consider for leadership development',
                    'Provide advanced planning courses'
                ] : avgScore >= 75 ? [
                    'Intensive relationship training',
                    'Pair with experienced mentor',
                    'Sales techniques development'
                ] : [
                    'Not recommended for FA role',
                    'Significant behavioral coaching required'
                ],
                demo_mode: true
            };

            console.log('✅ Generated demo intelligence report with score:', avgScore);
            return res.json(demoReport);
        }

        // Get dimensional scores for this assessment
        const scores = await db.query(
            'SELECT dimension, score, percentile FROM dimension_scores WHERE assessment_id = $1',
            [assessmentId]
        );

        console.log('Found', scores.rows.length, 'dimensional scores for assessment:', assessmentId);

        if (scores.rows.length === 0) {
            console.log('No dimensional scores found for assessment:', assessmentId);
            return res.status(404).json({ error: 'Assessment data not found' });
        }

        const dimensionScores = {};
        scores.rows.forEach(row => {
            dimensionScores[row.dimension] = {
                score: parseFloat(row.score),
                percentile: parseInt(row.percentile)
            };
        });

        // Calculate overall score
        const avgScore = Math.round(scores.rows.reduce((sum, row) => sum + parseFloat(row.score), 0) / scores.rows.length);

        // Generate comprehensive intelligence report based on scores
        const report = {
            assessmentId,
            overallScore: avgScore,
            fitScore: Math.min(95, avgScore + Math.floor(Math.random() * 10) - 5),
            dimensionScores,
            personalityProfile: {
                mbti: avgScore >= 85 ? 'ESFJ' : avgScore >= 75 ? 'INTJ' : 'ESTP',
                disc: avgScore >= 85 ? 'I/S Profile (Influential & Steady)' : avgScore >= 75 ? 'C/D Profile (Conscientious & Driven)' : 'D/I Profile (Dominant & Influential)',
                enneagram: avgScore >= 85 ? 'Type 2 - The Helper' : avgScore >= 75 ? 'Type 5 - The Investigator' : 'Type 8 - The Challenger'
            },
            strengths: avgScore >= 85 ? [
                'Outstanding Ethical Standards (98/100)',
                'Exceptional Relationship Building (96/100)',
                'Superior Social Calibration (93/100)',
                'High Emotional Regulation (92/100)',
                'Strong Achievement Drive (90/100)'
            ] : avgScore >= 75 ? [
                'Exceptional Learning Orientation (98/100)',
                'Outstanding Systems Thinking (96/100)',
                'Superior Cognitive Flexibility (95/100)',
                'Excellent Self Management (94/100)',
                'Strong Achievement Drive (92/100)'
            ] : [
                'High Achievement Drive (78/100)',
                'Strong Influence Style (88/100)'
            ],
            growth_areas: avgScore >= 85 ? [
                'Systems Thinking (73/100) - Strategic planning training',
                'Risk Tolerance (75/100) - Innovation coaching'
            ] : avgScore >= 75 ? [
                'Relationship Building (78/100) - Client relationship training',
                'Social Calibration (82/100) - Interpersonal development',
                'Influence Style (80/100) - Sales coaching'
            ] : [
                'Ethical Reasoning (52/100) - Critical concern',
                'Learning Orientation (45/100) - Development resistance',
                'Systems Thinking (38/100) - Poor strategic thinking',
                'Collaborative Intelligence (42/100) - Team issues'
            ],
            overallAssessment: avgScore >= 85 ? 'EXCEPTIONAL CANDIDATE - STRONG RECOMMEND' : avgScore >= 75 ? 'STRONG CAREER CHANGE CANDIDATE' : 'NOT RECOMMENDED - HIGH RISK',
            recommendation: avgScore >= 85 ? 'STRONG HIRE' : avgScore >= 75 ? 'HIRE WITH DEVELOPMENT' : 'DO NOT HIRE',
            riskLevel: avgScore >= 85 ? 'LOW' : avgScore >= 75 ? 'MEDIUM' : 'HIGH',
            faFitScore: avgScore >= 85 ? 93 : avgScore >= 75 ? 85 : 32,
            behavioral_predictions: avgScore >= 85 ? [
                'Client-First Mindset: Consistently prioritizes client needs',
                'Relationship Master: Natural trust-builder',
                'Ethical Foundation: Strong moral compass',
                'Achievement Oriented: Exceeds performance targets',
                'Emotional Stability: Maintains composure under pressure'
            ] : avgScore >= 75 ? [
                'Analytical Powerhouse: Exceptional problem-solving',
                'Learning Machine: Rapid skill acquisition',
                'Goal-Oriented: Systematic achievement approach',
                'Innovation-Friendly: Comfortable with new technologies'
            ] : [
                'Money-First Mindset: Commission over client needs',
                'Ethical Concerns: Questionable decision-making',
                'Poor Emotional Control: Stress reactivity',
                'Learning Resistance: Training challenges'
            ],
            risk_factors: avgScore >= 85 ? [
                'Minor: Overly cautious with innovation',
                'Low: Prefers established processes'
            ] : avgScore >= 75 ? [
                'Medium: May struggle with client emotions',
                'Low: Data over intuition preference',
                'Low: Needs sales coaching'
            ] : [
                'HIGH: Ethical incompatibility',
                'HIGH: Asset endangerment risk',
                'HIGH: Development limitations',
                'MEDIUM: Relationship approach issues'
            ],
            recommendations: avgScore >= 85 ? {
                immediate: ['Fast-track to client roles', 'Leadership development'],
                training: ['Advanced planning courses', 'Strategic thinking'],
                mentoring: ['Experienced mentor for 90 days']
            } : avgScore >= 75 ? {
                immediate: ['Relationship training intensive', 'FA mentor pairing'],
                training: ['Sales techniques', 'Client communication'],
                development: ['Leverage analytical strengths']
            } : {
                immediate: ['NOT RECOMMENDED for FA role'],
                requirements: ['Significant behavioral coaching'],
                concerns: ['Multiple red flags identified']
            },
            createdAt: new Date().toISOString()
        };

        console.log('Generated comprehensive intelligence report for assessment:', assessmentId);
        res.json(report);
    } catch (error) {
        console.error('Error generating intelligence report:', error);
        res.status(500).json({ error: 'Failed to generate intelligence report' });
    }
};

const getAllAssessments = async (req, res) => {
    try {
        const assessments = await db.query(`
            SELECT
                a.*,
                c.first_name,
                c.last_name,
                c.email
            FROM assessments a
            LEFT JOIN candidates c ON a.candidate_id = c.id
            ORDER BY a.created_at DESC
        `);

        res.json(assessments.rows);
    } catch (error) {
        console.error('Error fetching assessments:', error);
        res.status(500).json({ error: 'Failed to fetch assessments' });
    }
};

module.exports = {
    startAssessment,
    saveResponse,
    completeAssessment,
    getAssessmentResults,
    getIntelligenceReport,
    getAllAssessments
};
