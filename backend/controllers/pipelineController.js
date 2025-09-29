const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const getPipelineStages = async (req, res) => {
    try {
        const stages = await db.query(
            'SELECT * FROM pipeline_stages ORDER BY order_position'
        );
        
        res.json(stages.rows);
    } catch (error) {
        console.error('Get pipeline stages error:', error);
        res.status(500).json({ error: 'Failed to get pipeline stages' });
    }
};

const getPipelineView = async (req, res) => {
    try {
        const recruiterId = req.user.userId;
        
        // Get all stages with candidates
        const pipeline = await db.query(`
            SELECT 
                ps.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', c.id,
                            'first_name', c.first_name,
                            'last_name', c.last_name,
                            'email', c.email,
                            'phone', c.phone,
                            'pipeline_id', cp.id,
                            'moved_at', cp.moved_at,
                            'notes', cp.notes,
                            'assessment_status', a.status,
                            'completion_percentage', a.completion_percentage,
                            'cultural_fit_score', ir.cultural_fit_score,
                            'top_strength', (
                                SELECT dimension 
                                FROM dimension_scores 
                                WHERE assessment_id = a.id 
                                ORDER BY score DESC 
                                LIMIT 1
                            )
                        ) ORDER BY cp.moved_at DESC
                    ) FILTER (WHERE c.id IS NOT NULL),
                    '[]'
                ) as candidates
            FROM pipeline_stages ps
            LEFT JOIN candidate_pipeline cp ON cp.stage_id = ps.id
            LEFT JOIN candidates c ON c.id = cp.candidate_id AND c.recruiter_id = $1
            LEFT JOIN assessments a ON a.candidate_id = c.id
            LEFT JOIN intelligence_reports ir ON ir.assessment_id = a.id
            GROUP BY ps.id
            ORDER BY ps.order_position
        `, [recruiterId]);
        
        res.json(pipeline.rows);
    } catch (error) {
        console.error('Get pipeline view error:', error);
        res.status(500).json({ error: 'Failed to get pipeline view' });
    }
};

const moveCandidate = async (req, res) => {
    try {
        const { candidateId, stageId, notes } = req.body;
        const recruiterId = req.user.userId;
        
        // Verify candidate belongs to recruiter
        const candidate = await db.query(
            'SELECT id FROM candidates WHERE id = $1 AND recruiter_id = $2',
            [candidateId, recruiterId]
        );
        
        if (candidate.rows.length === 0) {
            return res.status(404).json({ error: 'Candidate not found' });
        }
        
        // Update or insert pipeline status
        await db.query(`
            INSERT INTO candidate_pipeline (candidate_id, stage_id, moved_by, notes, moved_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (candidate_id) 
            DO UPDATE SET 
                stage_id = $2,
                moved_by = $3,
                notes = $4,
                moved_at = CURRENT_TIMESTAMP
        `, [candidateId, stageId, recruiterId, notes]);
        
        // Emit real-time update
        const io = req.app.get('io');
        io.to(`recruiter-${recruiterId}`).emit('pipeline-updated', {
            candidateId,
            stageId,
            movedBy: recruiterId
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Move candidate error:', error);
        res.status(500).json({ error: 'Failed to move candidate' });
    }
};

const bulkMoveCandidate = async (req, res) => {
    try {
        const { candidateIds, stageId } = req.body;
        const recruiterId = req.user.userId;
        
        // Start transaction
        await db.query('BEGIN');
        
        for (const candidateId of candidateIds) {
            await db.query(`
                INSERT INTO candidate_pipeline (candidate_id, stage_id, moved_by, moved_at)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                ON CONFLICT (candidate_id) 
                DO UPDATE SET 
                    stage_id = $2,
                    moved_by = $3,
                    moved_at = CURRENT_TIMESTAMP
            `, [candidateId, stageId, recruiterId]);
        }
        
        await db.query('COMMIT');
        
        // Emit real-time update
        const io = req.app.get('io');
        io.to(`recruiter-${recruiterId}`).emit('pipeline-bulk-updated', {
            candidateIds,
            stageId
        });
        
        res.json({ success: true, movedCount: candidateIds.length });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Bulk move error:', error);
        res.status(500).json({ error: 'Failed to move candidates' });
    }
};

module.exports = {
    getPipelineStages,
    getPipelineView,
    moveCandidate,
    bulkMoveCandidate
};
