const express = require('express');
const router = express.Router();
const BulkActionsService = require('../services/bulkActions');
const bulkActionsService = new BulkActionsService();

router.post('/execute', async (req, res) => {
  try {
    const { action_type, candidate_ids, parameters } = req.body;
    if (!action_type || !candidate_ids || candidate_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'action_type and candidate_ids are required' });
    }
    const job = await bulkActionsService.createBulkJob(action_type, candidate_ids, parameters || {});
    res.json({ success: true, job_id: job.id, status: job.status, total_count: job.total_count });
  } catch (error) {
    console.error('Bulk action error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await bulkActionsService.getJobStatus(jobId);
    res.json({ success: true, job: status });
  } catch (error) {
    console.error('Get job status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/templates', async (req, res) => {
  try {
    const { type } = req.query;
    const templates = await bulkActionsService.getTemplates(type || null);
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/templates', async (req, res) => {
  try {
    const { name, type, base_template, variables } = req.body;
    if (!name || !type || !base_template) {
      return res.status(400).json({ success: false, error: 'name, type, and base_template are required' });
    }
    const template = await bulkActionsService.createTemplate(name, type, base_template, variables || []);
    res.json({ success: true, template });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/personalize-emails', async (req, res) => {
  try {
    const { candidate_ids, template_id } = req.body;
    const job = await bulkActionsService.createBulkJob('personalized_email', candidate_ids || [], { templateId: template_id });
    res.json({ success: true, job_id: job.id, message: `Personalizing emails for ${job.total_count} candidates` });
  } catch (error) {
    console.error('Personalize emails error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/linkedin-connect', async (req, res) => {
  try {
    const { candidate_ids } = req.body;
    const job = await bulkActionsService.createBulkJob('linkedin_connect', candidate_ids || [], {});
    res.json({ success: true, job_id: job.id, message: `Creating LinkedIn messages for ${job.total_count} candidates` });
  } catch (error) {
    console.error('LinkedIn connect error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/add-tags', async (req, res) => {
  try {
    const { candidate_ids, tag } = req.body;
    const job = await bulkActionsService.createBulkJob('tag', candidate_ids || [], { tag: tag || 'bulk_contacted' });
    res.json({ success: true, job_id: job.id, message: `Adding tag to ${job.total_count} candidates` });
  } catch (error) {
    console.error('Add tags error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/move-to-pipeline', async (req, res) => {
  try {
    const { candidate_ids, stage } = req.body;
    const job = await bulkActionsService.createBulkJob('pipeline_move', candidate_ids || [], { stage: stage || 'contacted' });
    res.json({ success: true, job_id: job.id, message: `Moving ${job.total_count} candidates` });
  } catch (error) {
    console.error('Move to pipeline error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;


