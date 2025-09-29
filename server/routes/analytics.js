const express = require('express');
const router = express.Router();

// Simple endpoint to record analytics events
router.post('/event', async (req, res) => {
  try {
    const { eventType, eventCategory, candidateId, assessmentId, eventData, metrics, processingTimeMs, apiEndpoint, userAgent } = req.body || {};
    await global.db.query(`
      INSERT INTO analytics_events (id, event_type, event_category, candidate_id, assessment_id, event_data, metrics, processing_time_ms, api_endpoint, user_agent, ip_address)
      VALUES (uuid_generate_v4(), $1, COALESCE($2,'assessment'), $3, $4, COALESCE($5,'{}'::jsonb), COALESCE($6,'{}'::jsonb), $7, $8, $9, $10)
    `, [eventType, eventCategory, candidateId, assessmentId, eventData, metrics, processingTimeMs, apiEndpoint, userAgent || req.headers['user-agent'], req.ip]);
    res.json({ success: true });
  } catch (error) {
    console.error('Analytics event error:', error);
    res.status(500).json({ success: false, error: 'Failed to record event' });
  }
});

module.exports = router;

