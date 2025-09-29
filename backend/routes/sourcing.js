const express = require('express');
const router = express.Router();
const LinkedInSearchService = require('../services/sourcing/linkedinSearch');
const pool = require('../config/database');
const SignalDetectionService = require('../services/sourcing/signalDetection');
const BulkActionsService = require('../services/sourcing/bulkActions');
const bulkActionRoutes = require('./bulkActionRoutes');

const linkedInSearch = new LinkedInSearchService();
const signalDetection = new SignalDetectionService();
const bulkActions = new BulkActionsService();
const enrichmentService = require('../services/sourcing/candidateEnrichment');

// Search LinkedIn profiles
router.post('/search/linkedin', async (req, res) => {
  try {
    const { title, location, keywords, limit = 20, page = 1, targetType } = req.body;
    
    // Search profiles
    const startIndex = ((Number(page) || 1) - 1) * (Number(limit) || 10) + 1; // Google CSE 1-based
    let results = await linkedInSearch.searchProfiles({
      title,
      location,
      keywords,
      broad: req.query?.broad === 'true' || req.body?.broad === true
    }, startIndex, limit);
    
    // Optionally accumulate across multiple pages if fewer than requested
    let items = results.items || [];
    const numericLimit = Number(limit) || 10;
    let safetyCounter = 0;
    while (items.length < numericLimit && results.nextPage && safetyCounter < 3) {
      const nextIndex = results.nextPage.startIndex || (startIndex + items.length);
      const next = await linkedInSearch.searchProfiles({ title, location, keywords }, nextIndex, numericLimit - items.length);
      items = items.concat(next.items || []);
      results = { ...results, nextPage: next.nextPage, totalResults: results.totalResults };
      safetyCounter++;
    }

    // Parse and score results
    const candidates = items.map(item => {
      const parsed = linkedInSearch.parseSearchResult(item);
      const score = linkedInSearch.scoreCandidate(parsed);
      return { ...parsed, score };
    });
    
    // Sort by score
    candidates.sort((a, b) => b.score - a.score);
    
    const totalResults = Number(results.totalResults) || candidates.length;
    const totalPages = Math.max(1, Math.ceil(totalResults / numericLimit));
    const currentPage = Number(page) || 1;

    res.json({
      success: true,
      results: candidates.slice(0, numericLimit),
      page: currentPage,
      totalPages,
      totalResults,
      hasMore: currentPage < totalPages
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Save sourced candidate (updated for your schema)
router.post('/candidates/sourced', async (req, res) => {
  try {
    const candidate = req.body;
    
    // Check if already exists
    const existing = await pool.query(
      'SELECT id FROM sourced_candidates WHERE linkedin_url = $1 OR profile_url = $1',
      [candidate.linkedin_url]
    );
    
    if (existing.rows.length > 0) {
      return res.status(409).json({ 
        success: false,
        error: 'Candidate already exists',
        id: existing.rows[0].id 
      });
    }
    
    // Insert new candidate with both old and new columns
    const result = await pool.query(
      `INSERT INTO sourced_candidates 
       (source_platform, full_name, profile_url, source, source_url, linkedin_url, 
        name, title, company, location, current_title, current_company, 
        raw_data, score, match_score, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        'linkedin',              // source_platform (required)
        candidate.name,          // full_name (required)
        candidate.linkedin_url,  // profile_url
        'linkedin',              // source
        candidate.linkedin_url,  // source_url
        candidate.linkedin_url,  // linkedin_url
        candidate.name,          // name
        candidate.title,         // title
        candidate.company,       // company
        candidate.location,      // location
        candidate.title,         // current_title
        candidate.company,       // current_company
        JSON.stringify(candidate.raw_data || {}), // raw_data
        candidate.score,         // score
        candidate.score / 100,   // match_score (0-1 scale)
        'new'                    // status
      ]
    );
    
    res.json({
      success: true,
      candidate: result.rows[0]
    });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get sourced candidates
router.get('/candidates/sourced', async (req, res) => {
  try {
    const { status = 'new', limit = 50 } = req.query;
    
    const result = await pool.query(
      `SELECT * FROM sourced_candidates 
       WHERE status = $1 
       ORDER BY score DESC, created_at DESC 
       LIMIT $2`,
      [status, limit]
    );
    
    res.json({
      success: true,
      candidates: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Update candidate status
router.put('/candidates/sourced/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const result = await pool.query(
      `UPDATE sourced_candidates 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found'
      });
    }
    
    res.json({
      success: true,
      candidate: result.rows[0]
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Create sourcing campaign
router.post('/campaigns', async (req, res) => {
  try {
    const { name, criteria, sources, daily_limit } = req.body;
    
    const result = await pool.query(
      `INSERT INTO sourcing_campaigns 
       (name, criteria, sources, daily_limit, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING *`,
      [
        name,
        JSON.stringify(criteria || {}),
        sources || ['linkedin'],
        daily_limit || 50
      ]
    );
    
    res.json({
      success: true,
      campaign: result.rows[0]
    });
  } catch (error) {
    console.error('Campaign creation error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ===== Signals Detection =====
router.post('/scan-signals', async (req, res) => {
  try {
    const results = await signalDetection.scanAllCandidates();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/active-seekers', async (req, res) => {
  try {
    const { min_score = 0.7 } = req.query;
    const seekers = await signalDetection.getActiveJobSeekers(parseFloat(min_score));
    res.json({ success: true, count: seekers.length, candidates: seekers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/candidates/:id/signals', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM job_seeking_signals WHERE candidate_id = $1 AND expires_at > NOW()',
      [id]
    );
    res.json({ success: true, signals: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Detect signals for a specific sourced candidate (Tier 2)
router.post('/signals/detect/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const candidateResult = await pool.query('SELECT * FROM sourced_candidates WHERE id = $1', [id]);
    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }

    const sc = candidateResult.rows[0];
    const rawData = (typeof sc.raw_data === 'string') ? JSON.parse(sc.raw_data || '{}') : (sc.raw_data || {});

    const candidateForDetection = {
      title: sc.title || sc.current_title || '',
      snippet: rawData?.snippet || '',
      name: sc.full_name || sc.name || '',
      company: sc.company || sc.current_company || '',
      location: sc.location || ''
    };

    const signals = await signalDetection.detectLinkedInSignals(candidateForDetection);

    if (signals.length > 0) {
      await signalDetection.saveSignals(sc.id, signals);
    }

    const score = signalDetection.calculateJobSeekingScore(signals);

    // Fetch current active signals after save
    const activeSignals = await pool.query(
      'SELECT signal_type, signal_strength, detected_at FROM job_seeking_signals WHERE candidate_id = $1 AND expires_at > NOW() ORDER BY signal_strength DESC',
      [sc.id]
    );

    res.json({
      success: true,
      candidate: { id: sc.id, name: sc.full_name || sc.name },
      detected_count: signals.length,
      job_seeking_score: score,
      signals: activeSignals.rows
    });
  } catch (error) {
    console.error('Detect signals error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enrich candidate data (ephemeral cache-backed)
router.post('/candidates/enrich', async (req, res) => {
  try {
    const { candidateId, linkedinUrl, name, company, title, snippet, location_text } = req.body || {};
    const enriched = await enrichmentService.enrichCandidate({
      candidateId,
      linkedinUrl,
      name,
      company,
      title,
      snippet,
      location_text
    });
    res.json(enriched);
  } catch (error) {
    console.error('Enrichment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Weighted signal statistics (Tier 2)
router.get('/signals/stats', async (req, res) => {
  try {
    const summary = await pool.query(`
      SELECT 
        COUNT(DISTINCT candidate_id) FILTER (WHERE job_seeking_score > 0) AS candidates_with_scores,
        COUNT(*) FILTER (WHERE job_seeking_score > 0) AS rows_with_scores,
        COALESCE(AVG(job_seeking_score), 0) AS avg_score
      FROM candidate_signal_scores
    `);

    const distribution = await pool.query(`
      SELECT bucket, count FROM (
        SELECT 
          CASE 
            WHEN job_seeking_score >= 0.8 THEN 'very_high'
            WHEN job_seeking_score >= 0.6 THEN 'high'
            WHEN job_seeking_score >= 0.4 THEN 'medium'
            WHEN job_seeking_score >= 0.2 THEN 'low'
            WHEN job_seeking_score >  0   THEN 'very_low'
            ELSE 'zero'
          END AS bucket,
          COUNT(*) AS count
        FROM candidate_signal_scores
        GROUP BY 1
      ) AS buckets
      ORDER BY 
        CASE 
          WHEN bucket = 'very_high' THEN 1
          WHEN bucket = 'high' THEN 2
          WHEN bucket = 'medium' THEN 3
          WHEN bucket = 'low' THEN 4
          WHEN bucket = 'very_low' THEN 5
          ELSE 6
        END
    `);

    res.json({
      success: true,
      summary: summary.rows[0],
      distribution: distribution.rows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== Bulk Actions =====
router.post('/bulk-actions', async (req, res) => {
  try {
    const { action_type, candidate_ids, parameters } = req.body;
    const result = await bulkActions.executeBulkAction(action_type, candidate_ids, parameters);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/bulk-actions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const status = await bulkActions.getBulkActionStatus(id);
    res.json({ success: true, action: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/bulk-personalize', async (req, res) => {
  try {
    const { candidate_ids, template_id } = req.body;
    const result = await bulkActions.executeBulkAction('personalize-emails', candidate_ids, { templateId: template_id });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/bulk-import', async (req, res) => {
  try {
    const { candidate_ids, stage = 'sourced' } = req.body;
    const result = await bulkActions.executeBulkAction('import-to-pipeline', candidate_ids, { stage });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============= CAREER CHANGE ROUTES =============

const CareerChangeScoringService = require('../services/careerChangeScoring');
const CareerChangeSearchService = require('../services/careerChangeSearch');
const careerScoringService = new CareerChangeScoringService();
const careerSearchService = new CareerChangeSearchService();

/**
 * Search for career change candidates by profession
 */
router.post('/career-change/search', async (req, res) => {
  try {
    const { profession, location = 'Milwaukee, WI', limit = 50 } = req.body;
    
    if (!profession) {
      return res.status(400).json({
        success: false,
        error: 'Profession is required'
      });
    }
    
    const results = await careerSearchService.searchProfession(profession, location, limit);
    
    res.json({
      success: true,
      count: results.length,
      profession: profession,
      candidates: results
    });
    
  } catch (error) {
    console.error('Career change search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Search all professions for career changers
 */
router.post('/career-change/search-all', async (req, res) => {
  try {
    const { location = 'Milwaukee, WI', limitPerProfession = 20 } = req.body;
    
    const results = await careerSearchService.searchAllProfessions(location, limitPerProfession);
    
    const totalCount = 
      results.tier1.length + 
      results.tier2.length + 
      results.tier3.length;
    
    res.json({
      success: true,
      totalCount,
      results
    });
    
  } catch (error) {
    console.error('Career change search all error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Calculate career change score for candidates
 */
router.post('/career-change/score', async (req, res) => {
  try {
    const { candidateIds, sourceTable = 'sourced_candidates' } = req.body;
    
    if (!candidateIds || candidateIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Candidate IDs are required'
      });
    }
    
    // For single candidate
    if (candidateIds.length === 1) {
      const score = await careerScoringService.calculateCareerChangeScore(
        candidateIds[0], 
        sourceTable
      );
      
      return res.json({
        success: true,
        score
      });
    }
    
    // For multiple candidates
    const results = await careerScoringService.bulkScoreCandidates(candidateIds, sourceTable);
    
    res.json({
      success: true,
      scored: results.success.length,
      failed: results.failed.length,
      results
    });
    
  } catch (error) {
    console.error('Career change scoring error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get top career change candidates
 */
router.get('/career-change/top-candidates', async (req, res) => {
  try {
    const { limit = 50, minScore = 0.6 } = req.query;
    
    const candidates = await careerScoringService.getTopCareerChangers(
      parseInt(limit), 
      parseFloat(minScore)
    );
    
    res.json({
      success: true,
      count: candidates.length,
      candidates
    });
    
  } catch (error) {
    console.error('Get top candidates error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get profession mappings
 */
router.get('/career-change/professions', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM profession_mappings WHERE active = true ORDER BY tier ASC'
    );
    
    res.json({
      success: true,
      professions: result.rows
    });
    
  } catch (error) {
    console.error('Get professions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update profession mapping
 */
router.put('/career-change/professions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Build update query dynamically
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(updates)];
    
    const result = await pool.query(
      `UPDATE profession_mappings SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );
    
    res.json({
      success: true,
      profession: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update profession error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get career change templates
 */
router.get('/career-change/templates', async (req, res) => {
  try {
    const { profession, type } = req.query;
    
    let query = 'SELECT * FROM career_change_templates WHERE active = true';
    const values = [];
    
    if (profession) {
      query += ' AND profession_category = $1';
      values.push(profession);
    }
    
    if (type) {
      query += values.length > 0 ? ' AND template_type = $2' : ' AND template_type = $1';
      values.push(type);
    }
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      templates: result.rows
    });
    
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Tier 3 Bulk Action APIs (v2 namespace to avoid conflict with legacy /bulk-actions/:id)
router.use('/bulk-actions/v2', bulkActionRoutes);

// Status endpoint
router.get('/status', (req, res) => {
  res.json({
    status: 'active',
    services: {
      linkedin: 'available',
      enrichment: 'available',
      detection: 'available'
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
