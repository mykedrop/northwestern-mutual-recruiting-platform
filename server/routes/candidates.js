const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all candidates
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await db.query(`
      SELECT 
        c.*,
        ps.name as pipeline_stage,
        a.status as assessment_status,
        a.completion_percentage
      FROM candidates c
      LEFT JOIN candidate_pipeline cp ON c.id = cp.candidate_id
      LEFT JOIN pipeline_stages ps ON cp.stage_id = ps.id
      LEFT JOIN assessments a ON c.id = a.candidate_id
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// Create new candidate or update existing
router.post('/', async (req, res) => {
  try {
    console.log('=== CANDIDATE IMPORT DEBUG ===');
    console.log('1. Request body:', req.body);
    console.log('2. Request headers:', req.headers);
    console.log('3. User from auth:', req.user);
    
    const {
      first_name,
      last_name,
      email,
      phone,
      status,
      source,
      skills,
      years_experience
    } = req.body;

    // Get recruiter ID from auth (if available) or use a default
    const recruiterId = req.user?.userId || 'f52e6779-a3bc-4895-a94d-5c6540c2d2c6'; // Default recruiter ID

    console.log('4. Parsed data:', { first_name, last_name, email, phone, status, source, skills, years_experience, recruiterId });

    // Check if candidate already exists
    console.log('5. Checking for existing candidate with email:', email);
    const existingCandidate = await db.query(
      'SELECT * FROM candidates WHERE email = $1',
      [email]
    );
    console.log('6. Existing candidate check result:', existingCandidate.rows.length > 0 ? 'FOUND' : 'NOT FOUND');

    if (existingCandidate.rows.length > 0) {
      // Update existing candidate instead of creating new
      const result = await db.query(
        `UPDATE candidates 
         SET first_name = $1, last_name = $2, phone = $3, 
             source = $4, recruiter_id = $5, updated_at = NOW()
         WHERE email = $6
         RETURNING *`,
        [first_name, last_name, phone, source || 'resume_upload', recruiterId, email]
      );
      
      console.log('Candidate updated:', result.rows[0]);

      // Check if candidate is already in pipeline, if not add them
      const pipelineCheck = await db.query(
        'SELECT id FROM candidate_pipeline WHERE candidate_id = $1',
        [result.rows[0].id]
      );

      if (pipelineCheck.rows.length === 0) {
        // Add candidate to pipeline (Applied stage)
        const appliedStageId = 'e21b9351-2093-404e-b0f3-aaa97c323293'; // Applied stage
        await db.query(
          `INSERT INTO candidate_pipeline (candidate_id, stage_id, moved_by, moved_at)
           VALUES ($1, $2, $3, NOW())`,
          [result.rows[0].id, appliedStageId, recruiterId]
        );
        console.log('Existing candidate added to pipeline');
      }

      // Emit real-time update
      const emitUpdate = req.app.get('emitUpdate');
      if (emitUpdate) {
        emitUpdate('candidate:updated', {
          id: result.rows[0].id,
          name: `${first_name} ${last_name}`,
          email: email,
          phone: phone,
          source: source || 'resume_upload',
          updatedAt: new Date().toISOString()
        });
      }
      
      return res.json({
        success: true,
        id: result.rows[0].id,
        candidate: result.rows[0],
        message: 'Candidate updated successfully (email already existed)'
      });
    }

    // Create new candidate if doesn't exist
    console.log('7. Creating new candidate with data:', [first_name, last_name, email, phone, source || 'manual', recruiterId]);
    const result = await db.query(
      `INSERT INTO candidates 
      (first_name, last_name, email, phone, source, recruiter_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *`,
      [
        first_name, 
        last_name, 
        email, 
        phone, 
        source || 'manual',
        recruiterId
      ]
    );

    console.log('8. Database result:', result.rows[0]);
    console.log('9. New candidate ID:', result.rows[0].id);

    // Add candidate to pipeline (Applied stage)
    const appliedStageId = 'e21b9351-2093-404e-b0f3-aaa97c323293'; // Applied stage
    console.log('10. Adding candidate to pipeline with stage ID:', appliedStageId);
    await db.query(
      `INSERT INTO candidate_pipeline (candidate_id, stage_id, moved_by, moved_at)
       VALUES ($1, $2, $3, NOW())`,
      [result.rows[0].id, appliedStageId, recruiterId]
    );

    console.log('11. Pipeline assignment completed for candidate ID:', result.rows[0].id);

    console.log('12. Final candidate ID returned:', result.rows[0].id);
    
    // IMMEDIATELY verify the save worked
    console.log('13. Verifying candidate exists in database...');
    const verifyQuery = await db.query(
      'SELECT * FROM candidates WHERE id = $1',
      [result.rows[0].id]
    );
    
    console.log('VERIFICATION - Candidate in DB:', verifyQuery.rows[0]);
    
    // Also verify pipeline assignment
    const pipelineVerify = await db.query(
      'SELECT * FROM candidate_pipeline WHERE candidate_id = $1',
      [result.rows[0].id]
    );
    
    console.log('VERIFICATION - Pipeline entry:', pipelineVerify.rows[0]);
    
    console.log('=== CANDIDATE IMPORT DEBUG COMPLETE ===');

    // Emit real-time update for new candidate
    const emitUpdate = req.app.get('emitUpdate');
    if (emitUpdate) {
      emitUpdate('candidate:created', {
        id: result.rows[0].id,
        name: `${first_name} ${last_name}`,
        email: email,
        phone: phone,
        source: source || 'manual',
        pipelineStage: 'applied',
        createdAt: new Date().toISOString()
      });
    }
    
    // Return the FULL candidate object with verification
    res.json({
      success: true,
      id: result.rows[0].id,
      candidate: verifyQuery.rows[0],
      pipelineEntry: pipelineVerify.rows[0],
      message: 'Candidate created successfully and added to pipeline'
    });
  } catch (error) {
    console.error('Create/Update candidate error:', error);
    res.status(400).json({ 
      success: false,
      error: error.message,
      detail: error.detail || 'Failed to import candidate'
    });
  }
});

// List candidates with assessment summary (for dashboard)
router.get('/assessments', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.id, c.first_name, c.last_name, c.email,
             c.assessment_status as status,
             c.assessment_score,
             c.assessment_tier as tier,
             c.authenticity_score,
             c.behavioral_flags as cheat_flags,
             a.end_time as completed_at,
             a.start_time as created_at,
             a.duration_seconds
      FROM candidates c
      LEFT JOIN assessments a ON a.candidate_id = c.id
      ORDER BY COALESCE(a.end_time, a.start_time) DESC NULLS LAST
      LIMIT 200
    `);
    res.json({ success: true, candidates: result.rows });
  } catch (error) {
    console.error('Candidates list error:', error);
    res.status(500).json({ success: false, error: 'Failed to load candidates' });
  }
});

// Detailed candidate record
router.get('/:candidateId/detailed', async (req, res) => {
  try {
    const { candidateId } = req.params;
    const result = await db.query(`
      SELECT c.id, c.first_name, c.last_name, c.email, c.assessment_status as status,
             c.assessment_score, c.assessment_tier as tier, c.authenticity_score,
             c.behavioral_flags as cheat_flags, c.created_at, c.updated_at,
             a.end_time as completed_at, a.start_time, a.duration_seconds,
             a.responses, a.behavioral_data, a.score_breakdown
      FROM candidates c
      LEFT JOIN assessments a ON a.candidate_id = c.id
      WHERE c.id = $1
      ORDER BY a.end_time DESC NULLS LAST
      LIMIT 1
    `, [candidateId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }
    
    const candidate = result.rows[0];
    
    // Transform the data to match what the frontend expects
    const transformedCandidate = {
      id: candidate.id,
      first_name: candidate.first_name,
      last_name: candidate.last_name,
      email: candidate.email,
      status: candidate.status,
      assessment_score: candidate.assessment_score,
      tier: candidate.tier,
      authenticity_score: candidate.authenticity_score,
      cheat_flags: candidate.cheat_flags,
      completed_at: candidate.completed_at,
      created_at: candidate.created_at,
      duration_seconds: candidate.duration_seconds,
      finalAnalysis: {
        dimensionalScores: candidate.score_breakdown || {},
        behavioralProfile: candidate.behavioral_data || {},
        consistencyScore: candidate.authenticity_score || 0,
        recommendations: []
      }
    };
    
    res.json(transformedCandidate);
  } catch (error) {
    console.error('Candidate detail error:', error);
    res.status(500).json({ success: false, error: 'Failed to load candidate details' });
  }
});

// Update candidate
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const result = await db.query(
      `UPDATE candidates 
       SET first_name = $1, last_name = $2, email = $3, phone = $4, 
           source = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [updates.first_name, updates.last_name, updates.email, updates.phone, updates.source, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Emit real-time update
    const emitUpdate = req.app.get('emitUpdate');
    if (emitUpdate) {
      emitUpdate('candidate:updated', {
        id: result.rows[0].id,
        name: `${result.rows[0].first_name} ${result.rows[0].last_name}`,
        email: result.rows[0].email,
        phone: result.rows[0].phone,
        source: result.rows[0].source,
        updatedAt: new Date().toISOString()
      });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update candidate error:', error);
    res.status(500).json({ error: 'Failed to update candidate' });
  }
});

// Delete candidate
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First get the candidate data for the real-time update
    const candidateResult = await db.query('SELECT * FROM candidates WHERE id = $1', [id]);
    
    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    // Delete from pipeline first (foreign key constraint)
    await db.query('DELETE FROM candidate_pipeline WHERE candidate_id = $1', [id]);
    
    // Delete the candidate
    await db.query('DELETE FROM candidates WHERE id = $1', [id]);

    // Emit real-time update
    const emitUpdate = req.app.get('emitUpdate');
    if (emitUpdate) {
      emitUpdate('candidate:deleted', {
        id: id,
        name: `${candidateResult.rows[0].first_name} ${candidateResult.rows[0].last_name}`,
        email: candidateResult.rows[0].email
      });
    }
    
    res.json({ success: true, message: 'Candidate deleted successfully' });
  } catch (error) {
    console.error('Delete candidate error:', error);
    res.status(500).json({ error: 'Failed to delete candidate' });
  }
});

// Import candidate from resume
router.post('/import', async (req, res) => {
  try {
    // This would handle file upload and parsing
    // For now, we'll simulate the import process
    const { name, email, phone } = req.body;
    
    const result = await db.query(
      `INSERT INTO candidates 
      (first_name, last_name, email, phone, source, recruiter_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *`,
      [name.split(' ')[0], name.split(' ')[1] || '', email, phone, 'resume_import', 'f52e6779-a3bc-4895-a94d-5c6540c2d2c6']
    );

    // Add to pipeline
    const appliedStageId = 'e21b9351-2093-404e-b0f3-aaa97c323293';
    await db.query(
      `INSERT INTO candidate_pipeline (candidate_id, stage_id, moved_by, moved_at)
       VALUES ($1, $2, $3, NOW())`,
      [result.rows[0].id, appliedStageId, 'f52e6779-a3bc-4895-a94d-5c6540c2d2c6']
    );

    // Emit real-time update
    const emitUpdate = req.app.get('emitUpdate');
    if (emitUpdate) {
      emitUpdate('candidate:created', {
        id: result.rows[0].id,
        name: name,
        email: email,
        phone: phone,
        source: 'resume_import',
        pipelineStage: 'applied',
        createdAt: new Date().toISOString()
      });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Import candidate error:', error);
    res.status(500).json({ error: 'Failed to import candidate' });
  }
});

// Bulk import candidates
router.post('/bulk-import', async (req, res) => {
  try {
    const candidates = req.body.candidates || [];
    const results = [];
    
    for (const candidateData of candidates) {
      const { name, email, phone } = candidateData;
      
      const result = await db.query(
        `INSERT INTO candidates 
        (first_name, last_name, email, phone, source, recruiter_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *`,
        [name.split(' ')[0], name.split(' ')[1] || '', email, phone, 'bulk_import', 'f52e6779-a3bc-4895-a94d-5c6540c2d2c6']
      );

      // Add to pipeline
      const appliedStageId = 'e21b9351-2093-404e-b0f3-aaa97c323293';
      await db.query(
        `INSERT INTO candidate_pipeline (candidate_id, stage_id, moved_by, moved_at)
         VALUES ($1, $2, $3, NOW())`,
        [result.rows[0].id, appliedStageId, 'f52e6779-a3bc-4895-a94d-5c6540c2d2c6']
      );

      results.push(result.rows[0]);

      // Emit real-time update for each candidate
      const emitUpdate = req.app.get('emitUpdate');
      if (emitUpdate) {
        emitUpdate('candidate:created', {
          id: result.rows[0].id,
          name: name,
          email: email,
          phone: phone,
          source: 'bulk_import',
          pipelineStage: 'applied',
          createdAt: new Date().toISOString()
        });
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Failed to bulk import candidates' });
  }
});

module.exports = router;

