const sgMail = require('@sendgrid/mail');
const pool = require('../../config/database');
const TemplateEngine = require('./templateEngine');

class EmailService {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    this.templateEngine = new TemplateEngine();
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL;
    this.fromName = process.env.SENDGRID_FROM_NAME || 'Northwestern Mutual Recruiting';
  }

  async sendEmail(to, subject, body, messageId = null) {
    const msg = {
      to,
      from: {
        email: this.fromEmail,
        name: this.fromName
      },
      subject,
      html: body,
      text: body.replace(/<[^>]*>/g, ''),
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
        subscriptionTracking: { enable: false }
      },
      customArgs: {
        messageId: messageId
      }
    };

    try {
      const [response] = await sgMail.send(msg);

      if (messageId) {
        await pool.query(
          'UPDATE outreach_messages SET status = $1, sent_at = NOW() WHERE id = $2',
          ['sent', messageId]
        );
      }

      return { success: true, messageId: response.headers['x-message-id'] };
    } catch (error) {
      console.error('Email send error:', error);

      if (messageId) {
        await pool.query(
          'UPDATE outreach_messages SET status = $1, error_message = $2 WHERE id = $3',
          ['failed', error.message, messageId]
        );
      }

      throw error;
    }
  }

  async sendBulkEmails(candidates, templateId, campaignId) {
    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    const templateResult = await pool.query(
      'SELECT * FROM outreach_templates WHERE id = $1',
      [templateId]
    );
    const template = templateResult.rows[0];

    for (const candidate of candidates) {
      try {
        const personalizedBody = await this.templateEngine.personalizeMessage(
          template.body_template,
          candidate,
          'high'
        );

        const personalizedSubject = this.templateEngine.renderTemplate(
          template.subject,
          { first_name: candidate.name?.split(' ')[0] }
        );

        const messageResult = await pool.query(
          `INSERT INTO outreach_messages 
           (campaign_id, candidate_id, channel, recipient_email, subject, body, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [campaignId, candidate.id, 'email', candidate.email, personalizedSubject, personalizedBody, 'pending']
        );

        await this.sendEmail(
          candidate.email,
          personalizedSubject,
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

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (campaignId) {
      await pool.query(
        `UPDATE outreach_campaigns 
         SET sent_count = sent_count + $1, updated_at = NOW() 
         WHERE id = $2`,
        [results.sent, campaignId]
      );
    }

    return results;
  }

  async handleWebhook(events) {
    for (const event of events) {
      const messageId = event.customArgs?.messageId;
      if (!messageId) continue;

      switch (event.event) {
        case 'delivered':
          await pool.query(
            'UPDATE outreach_messages SET status = $1, delivered_at = NOW() WHERE id = $2',
            ['delivered', messageId]
          );
          break;
        case 'open':
          await pool.query(
            'UPDATE outreach_messages SET status = $1, opened_at = NOW() WHERE id = $2',
            ['opened', messageId]
          );
          break;
        case 'click':
          await pool.query(
            'UPDATE outreach_messages SET clicked_at = NOW() WHERE id = $1',
            [messageId]
          );
          break;
      }
    }
  }
}

module.exports = EmailService;


