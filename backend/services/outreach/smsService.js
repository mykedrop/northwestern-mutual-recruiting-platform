const twilio = require('twilio');
const pool = require('../../config/database');
const TemplateEngine = require('./templateEngine');

class SMSService {
  constructor() {
    const hasCreds = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    if (hasCreds) {
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    } else {
      this.client = null;
      console.warn('Twilio credentials not set. SMSService will be disabled.');
    }
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
    this.templateEngine = new TemplateEngine();
  }

  async sendSMS(to, body, messageId = null) {
    if (!this.client) {
      const error = new Error('Twilio not configured');
      console.error('SMS send error:', error.message);
      if (messageId) {
        await pool.query(
          'UPDATE outreach_messages SET status = $1, error_message = $2 WHERE id = $3',
          ['failed', error.message, messageId]
        );
      }
      throw error;
    }
    try {
      const message = await this.client.messages.create({
        body: body.substring(0, 160),
        from: this.fromNumber,
        to: to,
        statusCallback: `${process.env.API_URL || 'http://localhost:8000'}/api/sourcing/outreach/webhooks/twilio/status`
      });

      if (messageId) {
        await pool.query(
          'UPDATE outreach_messages SET status = $1, sent_at = NOW() WHERE id = $2',
          ['sent', messageId]
        );
      }

      return { success: true, sid: message.sid };
    } catch (error) {
      console.error('SMS send error:', error);

      if (messageId) {
        await pool.query(
          'UPDATE outreach_messages SET status = $1, error_message = $2 WHERE id = $3',
          ['failed', error.message, messageId]
        );
      }

      throw error;
    }
  }

  async sendBulkSMS(candidates, template, campaignId) {
    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    for (const candidate of candidates) {
      if (!candidate.phone) continue;

      try {
        const personalizedBody = this.templateEngine.renderTemplate(
          template.body_template,
          {
            first_name: candidate.name?.split(' ')[0],
            company: 'Northwestern Mutual'
          }
        );

        const messageResult = await pool.query(
          `INSERT INTO outreach_messages 
           (campaign_id, candidate_id, channel, recipient_phone, body, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [campaignId, candidate.id, 'sms', candidate.phone, personalizedBody, 'pending']
        );

        await this.sendSMS(
          candidate.phone,
          personalizedBody,
          messageResult.rows[0].id
        );

        results.sent++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          candidateId: candidate.id,
          error: error.message
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }
}

module.exports = SMSService;


