const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const EmailService = require('../services/outreach/emailService');
const SMSService = require('../services/outreach/smsService');
const LinkedInService = require('../services/outreach/linkedinService');
const Bull = require('bull');

const emailService = new EmailService();
const smsService = new SMSService();
const linkedinService = new LinkedInService();

const outreachQueue = new Bull('outreach', process.env.REDIS_URL || undefined);

router.post('/templates', async (req, res) => {
  try {
    const { name, channel, subject, body_template, variables, category } = req.body;

    const result = await pool.query(
      `INSERT INTO outreach_templates 
       (name, channel, subject, body_template, variables, category)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, channel, subject, body_template, variables, category]
    );

    res.json({
      success: true,
      template: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List outreach templates
router.get('/templates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM outreach_templates ORDER BY created_at DESC');
    res.json({ success: true, templates: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/campaigns', async (req, res) => {
  try {
    const { name, template_id, candidate_ids, scheduled_at } = req.body;

    const campaignResult = await pool.query(
      `INSERT INTO outreach_campaigns 
       (name, template_id, total_recipients, scheduled_at, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, template_id, candidate_ids.length, scheduled_at, 'active']
    );

    const campaign = campaignResult.rows[0];

    await outreachQueue.add('process-campaign', {
      campaignId: campaign.id,
      candidateIds: candidate_ids
    }, {
      delay: scheduled_at ? new Date(scheduled_at) - new Date() : 0
    });

    res.json({
      success: true,
      campaign
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { candidate_ids, template_id, channel } = req.body;

    const candidatesResult = await pool.query(
      'SELECT * FROM sourced_candidates WHERE id = ANY($1::int[])',
      [candidate_ids]
    );

    const templateResult = await pool.query(
      'SELECT * FROM outreach_templates WHERE id = $1',
      [template_id]
    );

    const template = templateResult.rows[0];
    const candidates = candidatesResult.rows;

    let results;

    switch (channel) {
      case 'email':
        results = await emailService.sendBulkEmails(candidates, template_id, null);
        break;
      case 'sms':
        results = await smsService.sendBulkSMS(candidates, template, null);
        break;
      case 'linkedin':
        results = await linkedinService.sendBulkLinkedInMessages(candidates, template, null);
        break;
      default:
        throw new Error('Invalid channel');
    }

    res.json({
      success: true,
      results
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/campaigns/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;

    const metricsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
        COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked,
        COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END) as replied
      FROM outreach_messages
      WHERE campaign_id = $1
    `, [id]);

    res.json({
      success: true,
      metrics: metricsResult.rows[0]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

outreachQueue.process('process-campaign', async (job) => {
  const { campaignId, candidateIds } = job.data;

  const campaignResult = await pool.query(
    'SELECT * FROM outreach_campaigns WHERE id = $1',
    [campaignId]
  );
  const campaign = campaignResult.rows[0];

  const templateResult = await pool.query(
    'SELECT * FROM outreach_templates WHERE id = $1',
    [campaign.template_id]
  );
  const template = templateResult.rows[0];

  const candidatesResult = await pool.query(
    'SELECT * FROM sourced_candidates WHERE id = ANY($1::int[])',
    [candidateIds]
  );
  const candidates = candidatesResult.rows;

  let results;
  switch (template.channel) {
    case 'email':
      results = await emailService.sendBulkEmails(candidates, campaign.template_id, campaignId);
      break;
    case 'sms':
      results = await smsService.sendBulkSMS(candidates, template, campaignId);
      break;
    case 'linkedin':
      results = await linkedinService.sendBulkLinkedInMessages(candidates, template, campaignId);
      break;
  }

  return results;
});

// SendGrid webhook
router.post('/webhooks/sendgrid', async (req, res) => {
  try {
    const events = req.body;
    await emailService.handleWebhook(events);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

// Twilio webhook
router.post('/webhooks/twilio/status', async (req, res) => {
  try {
    const { MessageSid, MessageStatus, To, ErrorCode } = req.body;

    await pool.query(
      `UPDATE outreach_messages 
       SET status = $1, error_message = $2, delivered_at = CASE WHEN $1 = 'delivered' THEN NOW() ELSE delivered_at END
       WHERE recipient_phone = $3`,
      [MessageStatus, ErrorCode, To]
    );

    res.status(200).send('OK');
  } catch (error) {
    console.error('Twilio webhook error:', error);
    res.status(500).send('Error');
  }
});

module.exports = router;


