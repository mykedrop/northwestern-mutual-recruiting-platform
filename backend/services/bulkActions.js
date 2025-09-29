// backend/services/bulkActions.js
const db = require('../config/database');
const OpenAI = require('openai');
const Bull = require('bull');
// Simple internal concurrency limiter to avoid ESM import issues
function createLimiter(maxConcurrent) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= maxConcurrent) return;
    const task = queue.shift();
    if (!task) return;
    active++;
    Promise.resolve()
      .then(task.fn)
      .then((result) => {
        active--;
        task.resolve(result);
        next();
      })
      .catch((err) => {
        active--;
        task.reject(err);
        next();
      });
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let bulkQueue = null;
if (process.env.REDIS_URL && process.env.BULK_DISABLE_REDIS !== 'true') {
  try {
    // Configure to avoid endless retry timeouts when Redis is unreachable
    bulkQueue = new Bull('bulk-actions', process.env.REDIS_URL, {
      redis: { maxRetriesPerRequest: null },
      settings: { stalledInterval: 60000 }
    });
    bulkQueue.on('error', (err) => {
      console.error('Bulk queue error, falling back to synchronous processing:', err.message);
      try { bulkQueue.close(); } catch (_) {}
      bulkQueue = null;
    });
  } catch (err) {
    console.error('Failed to initialize Bull queue, falling back to sync:', err.message);
    bulkQueue = null;
  }
}

class BulkActionsService {
  constructor() {
    const concurrencyFromEnv = parseInt(process.env.BULK_ACTION_CONCURRENCY || '5', 10);
    this.concurrencyLimit = createLimiter(Number.isFinite(concurrencyFromEnv) ? concurrencyFromEnv : 5);
    if (bulkQueue) {
      bulkQueue.process('process-bulk-action', async (job) => {
        return this.processBulkJob(job.data.jobId);
      });
    }
  }

  async createBulkJob(actionType, candidateIds, parameters = {}) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const jobResult = await client.query(
        `INSERT INTO bulk_action_jobs 
         (action_type, status, total_count, parameters, created_by)
         VALUES ($1, 'pending', $2, $3, $4)
         RETURNING *`,
        [actionType, candidateIds.length, JSON.stringify(parameters), parameters.userId || 'system']
      );
      const job = jobResult.rows[0];

      for (const candidateId of candidateIds) {
        await client.query(
          `INSERT INTO bulk_action_items (job_id, candidate_id, action_type, status)
           VALUES ($1, $2, $3, 'pending')`,
          [job.id, candidateId, actionType]
        );
      }

      await client.query('COMMIT');

      // Prefer async queue; if unavailable, run synchronously in background
      if (bulkQueue) {
        try {
          await bulkQueue.add('process-bulk-action', { jobId: job.id });
        } catch (err) {
          console.error('Queue add failed, running sync:', err.message);
          setImmediate(() => this.processBulkJob(job.id).catch(console.error));
        }
      } else {
        setImmediate(() => this.processBulkJob(job.id).catch(console.error));
      }

      return job;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async processBulkJob(jobId) {
    await db.pool.query(
      `UPDATE bulk_action_jobs SET status = 'processing', started_at = NOW() WHERE id = $1`,
      [jobId]
    );

    try {
      const jobResult = await db.pool.query(`SELECT * FROM bulk_action_jobs WHERE id = $1`, [jobId]);
      const job = jobResult.rows[0];

      const itemsResult = await db.pool.query(
        `SELECT bi.*, sc.full_name, sc.email, sc.title as current_title, sc.company as current_company, sc.linkedin_url
         FROM bulk_action_items bi
         JOIN sourced_candidates sc ON bi.candidate_id = sc.id
         WHERE bi.job_id = $1`,
        [jobId]
      );
      const items = itemsResult.rows;

      const tasks = items.map((item) => this.concurrencyLimit(async () => {
        try {
          let result;
          switch (job.action_type) {
            case 'personalized_email':
              result = await this.personalizeEmail(item, job.parameters || {});
              break;
            case 'tag':
              result = await this.addTag(item, job.parameters || {});
              break;
            case 'linkedin_connect':
              result = await this.personalizeLinkedIn(item, job.parameters || {});
              break;
            case 'pipeline_move':
              result = await this.moveToPipeline(item, job.parameters || {});
              break;
            case 'career_change_score':
              result = await this.executeCareerChangeScoring([item.candidate_id], job.parameters || {});
              break;
            case 'career_change_outreach':
              result = await this.executeCareerChangeOutreach([item.candidate_id], job.parameters || {});
              break;
            default:
              throw new Error(`Unknown action type: ${job.action_type}`);
          }

          await db.pool.query(
            `UPDATE bulk_action_items
             SET status = 'completed', personalized_content = $2, result = $3, processed_at = NOW()
             WHERE id = $1`,
            [item.id, result.content || null, JSON.stringify(result)]
          );

          await db.pool.query(
            `UPDATE bulk_action_jobs
             SET processed_count = processed_count + 1, success_count = success_count + 1
             WHERE id = $1`,
            [jobId]
          );
        } catch (err) {
          await db.pool.query(
            `UPDATE bulk_action_items
             SET status = 'failed', error_message = $2, processed_at = NOW()
             WHERE id = $1`,
            [item.id, err.message]
          );

          await db.pool.query(
            `UPDATE bulk_action_jobs
             SET processed_count = processed_count + 1, failed_count = failed_count + 1, error_log = array_append(error_log, $2)
             WHERE id = $1`,
            [jobId, `Item ${item.id}: ${err.message}`]
          );
        }
      }));

      await Promise.all(tasks);

      await db.pool.query(
        `UPDATE bulk_action_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [jobId]
      );

      return { success: true };
    } catch (error) {
      await db.pool.query(
        `UPDATE bulk_action_jobs SET status = 'failed', completed_at = NOW(), error_log = array_append(error_log, $2) WHERE id = $1`,
        [jobId, error.message]
      );
      throw error;
    }
  }

  async personalizeEmail(item, parameters) {
    const templateId = parameters.templateId;
    let template;
    if (templateId) {
      const t = await db.pool.query(`SELECT * FROM personalization_templates WHERE id = $1`, [templateId]);
      template = t.rows[0];
    }
    if (!template) {
      template = { base_template: 'Hi {{firstName}}, I noticed your experience at {{company}}. Would you be interested in discussing opportunities at Northwestern Mutual?' };
    }

    try {
      if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
      const prompt = `Create a personalized email (<=150 words) for candidate:\nName: ${item.full_name}\nRole: ${item.current_title}\nCompany: ${item.current_company}\nBase: ${template.base_template}`;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a skilled recruiter personalizing outreach emails.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      });
      return { success: true, content: completion.choices[0].message.content, templateUsed: template.name };
    } catch (_) {
      // Fallback simple template replacement
      let content = template.base_template;
      content = content.replace('{{firstName}}', (item.full_name || '').split(' ')[0] || 'there');
      content = content.replace('{{company}}', item.current_company || 'your company');
      content = content.replace('{{primarySkill}}', 'your skills');
      return { success: true, content, templateUsed: template.name, fallback: true };
    }
  }

  async personalizeLinkedIn(item) {
    try {
      if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Write brief, personalized LinkedIn connection requests.' },
          { role: 'user', content: `Max 300 chars. Candidate ${item.full_name}, ${item.current_title} at ${item.current_company}. Mention something specific and why connect.` }
        ],
        temperature: 0.8,
        max_tokens: 120
      });
      return { success: true, content: completion.choices[0].message.content, type: 'linkedin_connect' };
    } catch (_) {
      return { success: true, content: `Hi ${(item.full_name||'').split(' ')[0]}, impressed by your work at ${item.current_company}. Would love to connect and share an opportunity.` , fallback: true };
    }
  }

  async addTag(item, parameters) {
    const tag = parameters.tag || 'bulk_contacted';
    await db.pool.query(
      `UPDATE sourced_candidates SET tags = array_append(COALESCE(tags, '{}'), $2), updated_at = NOW() WHERE id = $1`,
      [item.candidate_id, tag]
    );
    return { success: true, tag };
  }

  async moveToPipeline(item, parameters) {
    const stage = parameters.stage || 'contacted';
    // No-op pipeline integration stub: update sourced_candidates status
    await db.pool.query(
      `UPDATE sourced_candidates SET status = $2, updated_at = NOW() WHERE id = $1`,
      [item.candidate_id, stage]
    );
    return { success: true, stage };
  }

  async getJobStatus(jobId) {
    const jobResult = await db.pool.query(`SELECT * FROM bulk_action_progress WHERE id = $1`, [jobId]);
    if (jobResult.rows.length === 0) throw new Error('Job not found');
    const job = jobResult.rows[0];
    const items = await db.pool.query(
      `SELECT bi.*, sc.full_name FROM bulk_action_items bi JOIN sourced_candidates sc ON bi.candidate_id = sc.id WHERE bi.job_id = $1 ORDER BY bi.processed_at DESC NULLS LAST LIMIT 5`,
      [jobId]
    );
    return { ...job, recentItems: items.rows };
  }

  async getTemplates(type = null) {
    let sql = 'SELECT * FROM personalization_templates WHERE is_active = true';
    const params = [];
    if (type) {
      sql += ' AND template_type = $1';
      params.push(type);
    }
    sql += ' ORDER BY usage_count DESC NULLS LAST, created_at DESC';
    const result = await db.pool.query(sql, params);
    return result.rows;
  }

  async createTemplate(name, type, baseTemplate, variables = []) {
    const result = await db.pool.query(
      `INSERT INTO personalization_templates (name, template_type, base_template, variables)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, type, baseTemplate, variables]
    );
    return result.rows[0];
  }

  /**
   * Calculate career change scores in bulk
   */
  async executeCareerChangeScoring(candidateIds, parameters = {}) {
    const CareerChangeScoringService = require('./careerChangeScoring');
    const scoringService = new CareerChangeScoringService();
    
    const results = await scoringService.bulkScoreCandidates(
      candidateIds,
      parameters.sourceTable || 'sourced_candidates'
    );
    
    return {
      success: true,
      scored: results.success.length,
      failed: results.failed.length,
      results: results
    };
  }

  /**
   * Generate personalized outreach for career changers
   */
  async executeCareerChangeOutreach(candidateIds, parameters = {}) {
    const results = {
      generated: [],
      failed: []
    };
    
    for (const candidateId of candidateIds) {
      try {
        // Get candidate and their career change score
        const candidate = await db.pool.query(
          `SELECT sc.*, ccs.*, pm.messaging_hooks
           FROM sourced_candidates sc
           LEFT JOIN career_changer_scores ccs ON sc.id = ccs.sourced_candidate_id
           LEFT JOIN profession_mappings pm ON ccs.current_profession = pm.profession_category
           WHERE sc.id = $1`,
          [candidateId]
        );
        
        if (candidate.rows.length === 0) continue;
        
        const candidateData = candidate.rows[0];
        
        // Get appropriate template
        const template = await db.pool.query(
          `SELECT * FROM career_change_templates 
           WHERE profession_category = $1 
           AND template_type = $2
           LIMIT 1`,
          [candidateData.current_profession, parameters.templateType || 'initial_outreach']
        );
        
        if (template.rows.length === 0) {
          // Fall back to general template
          results.failed.push({ candidateId, reason: 'No template found' });
          continue;
        }
        
        // Personalize the template
        const personalizedContent = await this.personalizeCareerChangeMessage(
          template.rows[0],
          candidateData
        );
        
        results.generated.push({
          candidateId,
          content: personalizedContent
        });
        
      } catch (error) {
        results.failed.push({ candidateId, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Personalize career change message
   */
  async personalizeCareerChangeMessage(template, candidate) {
    // Build variable replacements
    const variables = {
      firstName: candidate.name?.split(' ')[0] || 'there',
      currentCompany: candidate.company || 'your company',
      yearsExperience: candidate.years_in_profession || 'several',
      currentTitle: candidate.title || 'your current role',
      recruiterName: 'Your Northwestern Mutual Team',
      specificAchievement: this.extractAchievement(candidate),
      painPoint: this.identifyPainPoint(candidate)
    };
    
    // Replace variables in template
    let message = template.email_template || template.linkedin_template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      message = message.replace(regex, value);
    }
    
    // Use AI for additional personalization if available
    if (process.env.OPENAI_API_KEY) {
      try {
        const enhanced = await this.enhanceWithAI(message, candidate);
        return enhanced;
      } catch (error) {
        console.error('AI enhancement failed, using template:', error);
      }
    }
    
    return {
      subject: this.personalizeString(template.subject_line, variables),
      body: message,
      channel: 'email'
    };
  }

  /**
   * Helper to personalize string templates
   */
  personalizeString(template, variables) {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  /**
   * Extract achievement from profile
   */
  extractAchievement(candidate) {
    // Look for achievement patterns in profile data
    const profileText = JSON.stringify(candidate.profile_data || {});
    
    const achievementPatterns = [
      /increased .+ by \d+%/i,
      /generated \$[\d,]+/i,
      /managed .+ team/i,
      /awarded .+/i,
      /top \d+%/i
    ];
    
    for (const pattern of achievementPatterns) {
      const match = profileText.match(pattern);
      if (match) {
        return `I was impressed by: "${match[0]}"`;
      }
    }
    
    return 'Your professional background caught my attention';
  }

  /**
   * Identify pain point based on profession and industry
   */
  identifyPainPoint(candidate) {
    const hooks = candidate.messaging_hooks || {};
    return hooks.pain_point || 'looking for a new challenge';
  }
}

module.exports = BulkActionsService;
