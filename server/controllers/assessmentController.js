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
        
        // Test database connection first
        try {
            await db.query('SELECT 1');
            console.log('Database connection test successful');
        } catch (dbError) {
            console.error('Database connection test failed:', dbError);
            return res.status(500).json({ error: 'Database connection failed' });
        }
        
        const report = await db.query(
            `SELECT * FROM intelligence_reports WHERE assessment_id = $1`,
            [assessmentId]
        );
        
        console.log('Database query result:', {
            rowCount: report.rows.length,
            hasData: report.rows.length > 0
        });
        
        if (report.rows.length === 0) {
            console.log('No intelligence report found for assessment:', assessmentId);
            return res.status(404).json({ error: 'Intelligence report not found' });
        }
        
        const data = report.rows[0];
        console.log('Raw data from database:', {
            strengths_type: typeof data.strengths,
            strengths_value: data.strengths,
            growth_areas_type: typeof data.growth_areas,
            growth_areas_value: data.growth_areas,
            behavioral_predictions_type: typeof data.behavioral_predictions,
            behavioral_predictions_value: data.behavioral_predictions
        });
        
        // Parse JSON fields safely
        const parsedReport = {
            ...data,
            strengths: data.strengths ? (typeof data.strengths === 'string' ? JSON.parse(data.strengths) : data.strengths) : [],
            growth_areas: data.growth_areas ? (typeof data.growth_areas === 'string' ? JSON.parse(data.growth_areas) : data.growth_areas) : [],
            behavioral_predictions: data.behavioral_predictions ? (typeof data.behavioral_predictions === 'string' ? JSON.parse(data.behavioral_predictions) : data.behavioral_predictions) : [],
            communication_style: data.communication_style ? (typeof data.communication_style === 'string' ? JSON.parse(data.communication_style) : data.communication_style) : null,
            work_style: data.work_style ? (typeof data.work_style === 'string' ? JSON.parse(data.work_style) : data.work_style) : null,
            team_dynamics: data.team_dynamics ? (typeof data.team_dynamics === 'string' ? data.team_dynamics : data.team_dynamics) : null,
            risk_factors: data.risk_factors ? (typeof data.risk_factors === 'string' ? JSON.parse(data.risk_factors) : data.risk_factors) : [],
            recommendations: data.recommendations ? (typeof data.recommendations === 'string' ? JSON.parse(data.recommendations) : data.recommendations) : null,
            role_fit_scores: data.role_fit_scores ? (typeof data.role_fit_scores === 'string' ? JSON.parse(data.role_fit_scores) : data.role_fit_scores) : null
        };
        
        console.log('Successfully parsed intelligence report');
        res.json(parsedReport);
    } catch (error) {
        console.error('Get intelligence report error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        res.status(500).json({ error: 'Failed to get intelligence report', details: error.message });
    }
};

module.exports = {
    startAssessment,
    saveResponse,
    completeAssessment,
    getAssessmentResults,
    getIntelligenceReport
};
