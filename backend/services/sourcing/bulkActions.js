const pool = require('../../config/database');
const EmailService = require('../outreach/emailService');
const TemplateEngine = require('../outreach/templateEngine');
const Bull = require('bull');

class BulkActionsService {
  constructor() {
    this.emailService = new EmailService();
    this.templateEngine = new TemplateEngine();
    this.bulkQueue = process.env.REDIS_URL ? new Bull('bulk-actions', process.env.REDIS_URL) : null;
    if (!this.bulkQueue) {
      console.warn('REDIS_URL not set. Bulk actions will run synchronously.');
    }
    this.setupQueueProcessors();
  }

  setupQueueProcessors() {
    if (this.bulkQueue) {
      this.bulkQueue.process('personalize-emails', async (job) => this.processPersonalizeEmails(job));
      this.bulkQueue.process('import-to-pipeline', async (job) => this.processImportToPipeline(job));
      this.bulkQueue.process('bulk-tag', async (job) => this.processBulkTag(job));
    }
  }

  async processPersonalizeEmails(jobOrData) {
    const data = jobOrData.data || jobOrData;
    const { candidateIds, templateId } = data;
    const candidates = await this.getCandidates(candidateIds);
    const template = await this.getTemplate(templateId);
    const personalized = [];
    for (const candidate of candidates) {
      const personalizedContent = await this.templateEngine.personalizeMessage(
        template.body_template,
        candidate,
        'high'
      );
      personalized.push({
        candidateId: candidate.id,
        email: candidate.email,
        subject: this.templateEngine.renderTemplate(template.subject, {
          first_name: candidate.name?.split(' ')[0]
        }),
        body: personalizedContent
      });
      if (jobOrData.progress) {
        jobOrData.progress(personalized.length / candidates.length * 100);
      }
    }
    return personalized;
  }

  async processImportToPipeline(jobOrData) {
    const data = jobOrData.data || jobOrData;
    const { candidateIds, stage } = data;
    const imported = [];
    const failed = [];
    for (const candidateId of candidateIds) {
      try {
        const sourceResult = await pool.query(
          'SELECT * FROM sourced_candidates WHERE id = $1',
          [candidateId]
        );
        const sourceCandidate = sourceResult.rows[0];
        const candidateResult = await pool.query(
          `INSERT INTO candidates 
           (name, email, phone, current_role, current_company, location, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            sourceCandidate.name,
            sourceCandidate.email,
            sourceCandidate.phone,
            sourceCandidate.title,
            sourceCandidate.company,
            sourceCandidate.location,
            stage
          ]
        );
        await pool.query(
          'UPDATE sourced_candidates SET imported_to_candidate = true, candidate_id = $1 WHERE id = $2',
          [candidateResult.rows[0].id, candidateId]
        );
        imported.push(candidateResult.rows[0].id);
      } catch (error) {
        failed.push({ candidateId, error: error.message });
      }
      if (jobOrData.progress) {
        jobOrData.progress((imported.length + failed.length) / candidateIds.length * 100);
      }
    }
    return { imported, failed };
  }

  async processBulkTag(jobOrData) {
    const data = jobOrData.data || jobOrData;
    const { candidateIds, tags } = data;
    const tagged = [];
    for (const candidateId of candidateIds) {
      await pool.query(
        'UPDATE sourced_candidates SET tags = array_cat(tags, $1::text[]) WHERE id = $2',
        [tags, candidateId]
      );
      tagged.push(candidateId);
      if (jobOrData.progress) {
        jobOrData.progress(tagged.length / candidateIds.length * 100);
      }
    }
    return { tagged };
  }

  async getCandidates(candidateIds) {
    const result = await pool.query(
      'SELECT * FROM sourced_candidates WHERE id = ANY($1::int[])',
      [candidateIds]
    );
    return result.rows;
  }

  async getTemplate(templateId) {
    const result = await pool.query(
      'SELECT * FROM outreach_templates WHERE id = $1',
      [templateId]
    );
    return result.rows[0];
  }

  async executeBulkAction(actionType, candidateIds, parameters) {
    const logResult = await pool.query(
      `INSERT INTO bulk_actions 
       (action_type, candidate_ids, total_count, status, parameters, initiated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        actionType,
        candidateIds,
        candidateIds.length,
        'processing',
        JSON.stringify(parameters || {}),
        parameters?.userId || 'system'
      ]
    );

    const bulkActionId = logResult.rows[0].id;
    if (!this.bulkQueue) {
      const startedAt = new Date();
      let result;
      if (actionType === 'bulk-tag') {
        result = await this.processBulkTag({ data: { candidateIds, tags: parameters.tags } });
        await pool.query(
          `UPDATE bulk_actions SET status = $1, successful_count = $2, failed_count = $3, started_at = $4, completed_at = NOW() WHERE id = $5`,
          ['completed', result.tagged.length, 0, startedAt, bulkActionId]
        );
      } else if (actionType === 'import-to-pipeline') {
        result = await this.processImportToPipeline({ data: { candidateIds, stage: parameters.stage } });
        await pool.query(
          `UPDATE bulk_actions SET status = $1, successful_count = $2, failed_count = $3, started_at = $4, completed_at = NOW() WHERE id = $5`,
          ['completed', result.imported.length, result.failed.length, startedAt, bulkActionId]
        );
      } else if (actionType === 'personalize-emails') {
        result = await this.processPersonalizeEmails({ data: { candidateIds, templateId: parameters.templateId } });
        await pool.query(
          `UPDATE bulk_actions SET status = $1, successful_count = $2, failed_count = $3, started_at = $4, completed_at = NOW() WHERE id = $5`,
          ['completed', result.length, 0, startedAt, bulkActionId]
        );
      } else {
        throw new Error('Unknown action type');
      }
      return { bulkActionId, status: 'completed', result };
    }

    try {
      const job = await this.bulkQueue.add(actionType, {
        ...parameters,
        candidateIds,
        bulkActionId
      });
      await pool.query(
        "UPDATE bulk_actions SET parameters = jsonb_set(parameters, '{jobId}', $1, true) WHERE id = $2",
        [JSON.stringify(job.id), bulkActionId]
      );
      return { bulkActionId, jobId: job.id, status: 'processing' };
    } catch (err) {
      console.warn('Queue add failed, falling back to synchronous processing:', err.message);
      // Fallback synchronously
      const startedAt = new Date();
      let result;
      if (actionType === 'bulk-tag') {
        result = await this.processBulkTag({ data: { candidateIds, tags: parameters.tags } });
        await pool.query(
          `UPDATE bulk_actions SET status = $1, successful_count = $2, failed_count = $3, started_at = $4, completed_at = NOW() WHERE id = $5`,
          ['completed', result.tagged.length, 0, startedAt, bulkActionId]
        );
      } else if (actionType === 'import-to-pipeline') {
        result = await this.processImportToPipeline({ data: { candidateIds, stage: parameters.stage } });
        await pool.query(
          `UPDATE bulk_actions SET status = $1, successful_count = $2, failed_count = $3, started_at = $4, completed_at = NOW() WHERE id = $5`,
          ['completed', result.imported.length, result.failed.length, startedAt, bulkActionId]
        );
      } else if (actionType === 'personalize-emails') {
        result = await this.processPersonalizeEmails({ data: { candidateIds, templateId: parameters.templateId } });
        await pool.query(
          `UPDATE bulk_actions SET status = $1, successful_count = $2, failed_count = $3, started_at = $4, completed_at = NOW() WHERE id = $5`,
          ['completed', result.length, 0, startedAt, bulkActionId]
        );
      }
      return { bulkActionId, status: 'completed', result };
    }
  }

  async getBulkActionStatus(bulkActionId) {
    const result = await pool.query(
      'SELECT * FROM bulk_actions WHERE id = $1',
      [bulkActionId]
    );

    const bulkAction = result.rows[0];

    if (bulkAction.parameters?.jobId) {
      const job = await this.bulkQueue.getJob(bulkAction.parameters.jobId);

      return {
        ...bulkAction,
        progress: job ? await job.progress() : 100,
        state: job ? await job.getState() : 'completed'
      };
    }

    return bulkAction;
  }
}

module.exports = BulkActionsService;


