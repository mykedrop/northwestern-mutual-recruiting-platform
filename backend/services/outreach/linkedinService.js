const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const pool = require('../../config/database');

puppeteer.use(StealthPlugin());

class LinkedInService {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 800 });

    await this.login();
  }

  async login() {
    await this.page.goto('https://www.linkedin.com/login');
    await this.page.type('#username', process.env.LINKEDIN_EMAIL);
    await this.page.type('#password', process.env.LINKEDIN_PASSWORD);
    await this.page.click('button[type="submit"]');
    await this.page.waitForNavigation();
    this.isLoggedIn = true;
  }

  async sendConnectionRequest(profileUrl, message) {
    try {
      await this.page.goto(profileUrl);
      await this.page.waitForTimeout(2000 + Math.random() * 2000);

      const connectButton = await this.page.$('button[aria-label*="Connect"]');
      if (connectButton) {
        await connectButton.click();
        await this.page.waitForTimeout(1000);

        const addNoteButton = await this.page.$('button[aria-label="Add a note"]');
        if (addNoteButton) {
          await addNoteButton.click();
          await this.page.waitForTimeout(500);

          const messageBox = await this.page.$('textarea[name="message"]');
          await messageBox.type(message);

          const sendButton = await this.page.$('button[aria-label="Send now"]');
          await sendButton.click();

          return { success: true };
        }
      }

      return { success: false, reason: 'Connect button not found' };
    } catch (error) {
      console.error('LinkedIn connection error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendMessage(profileUrl, message) {
    try {
      await this.page.goto(profileUrl);
      await this.page.waitForTimeout(2000 + Math.random() * 2000);

      const messageButton = await this.page.$('button[aria-label*="Message"]');
      if (messageButton) {
        await messageButton.click();
        await this.page.waitForTimeout(1000);

        const messageBox = await this.page.$('div[contenteditable="true"]');
        await messageBox.type(message);

        const sendButton = await this.page.$('button[type="submit"]');
        await sendButton.click();

        return { success: true };
      }

      return { success: false, reason: 'Message button not found' };
    } catch (error) {
      console.error('LinkedIn message error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendBulkLinkedInMessages(candidates, template, campaignId) {
    if (!this.isLoggedIn) {
      await this.initialize();
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    for (const candidate of candidates) {
      if (!candidate.linkedin_url) continue;

      try {
        const personalizedMessage = template.body_template
          .replace('{{first_name}}', candidate.name?.split(' ')[0] || '')
          .replace('{{title}}', candidate.title || '')
          .replace('{{company}}', candidate.company || '');

        const messageResult = await pool.query(
          `INSERT INTO outreach_messages 
           (campaign_id, candidate_id, channel, body, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [campaignId, candidate.id, 'linkedin', personalizedMessage, 'pending']
        );

        const result = await this.sendConnectionRequest(
          candidate.linkedin_url,
          personalizedMessage
        );

        if (result.success) {
          await pool.query(
            'UPDATE outreach_messages SET status = $1, sent_at = NOW() WHERE id = $2',
            ['sent', messageResult.rows[0].id]
          );
          results.sent++;
        } else {
          throw new Error(result.reason || 'Failed to send');
        }

      } catch (error) {
        results.failed++;
        results.errors.push({
          candidateId: candidate.id,
          error: error.message
        });
      }

      await new Promise(resolve => 
        setTimeout(resolve, 30000 + Math.random() * 30000)
      );
    }

    return results;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = LinkedInService;





