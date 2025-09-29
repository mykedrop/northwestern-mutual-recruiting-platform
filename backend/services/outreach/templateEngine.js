const Handlebars = require('handlebars');
const { OpenAI } = require('openai');

class TemplateEngine {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    Handlebars.registerHelper('capitalize', (str) => {
      return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    });

    Handlebars.registerHelper('first_name', (fullName) => {
      return fullName ? fullName.split(' ')[0] : '';
    });
  }

  renderTemplate(template, variables) {
    const compiled = Handlebars.compile(template);
    return compiled(variables);
  }

  async personalizeMessage(template, candidate, level = 'medium') {
    const baseMessage = this.renderTemplate(template, {
      first_name: candidate.name?.split(' ')[0],
      full_name: candidate.name,
      company: candidate.company,
      title: candidate.title,
      location: candidate.location
    });

    if (level === 'low') {
      return baseMessage;
    }

    const prompt = `
      Personalize this recruiting message based on the candidate's background.
      Keep the core message but add 1-2 personalized sentences.
      
      Candidate Info:
      - Name: ${candidate.name}
      - Current Role: ${candidate.title}
      - Company: ${candidate.company}
      - Location: ${candidate.location}
      - LinkedIn Summary: ${candidate.snippet || 'N/A'}
      
      Base Message:
      ${baseMessage}
      
      Rules:
      - Keep it professional but warm
      - Mention something specific from their background
      - Keep under 150 words
      - End with a clear call to action
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.7
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('GPT-4 personalization failed:', error);
      return baseMessage;
    }
  }

  async generateSubjectVariants(baseSubject, count = 3) {
    const prompt = `
      Generate ${count} email subject line variants for recruiting outreach.
      Base subject: "${baseSubject}"
      
      Make them:
      - Attention-grabbing but professional
      - Under 60 characters
      - Slightly different angles/approaches
      
      Return as JSON array of strings.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.8
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Subject generation failed:', error);
      return [baseSubject];
    }
  }
}

module.exports = TemplateEngine;


