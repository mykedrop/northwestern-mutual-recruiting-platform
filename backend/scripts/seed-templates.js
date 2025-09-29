const pool = require('../config/database');

async function seedTemplates() {
  const templates = [
    {
      name: 'Initial Outreach - Financial Advisor',
      channel: 'email',
      subject: 'Exciting Opportunity at Northwestern Mutual for {{first_name}}',
      body_template: `Hi {{first_name}},\n\nI came across your profile and was impressed by your experience as {{title}} at {{company}}.\n\nNorthwestern Mutual is expanding our team in {{location}}, and I believe your background aligns perfectly with what we're looking for.\n\nWe offer:\n• Industry-leading compensation and benefits\n• Comprehensive training and mentorship\n• Clear path to leadership roles\n• Award-winning culture and team support\n\nWould you be open to a brief conversation to learn more about this opportunity?\n\nBest regards,\nNorthwestern Mutual Recruiting Team`,
      variables: ['first_name', 'title', 'company', 'location'],
      category: 'initial_outreach'
    },
    {
      name: 'Follow Up - No Response',
      channel: 'email',
      subject: 'Following up - Northwestern Mutual Opportunity',
      body_template: `Hi {{first_name}},\n\nI wanted to follow up on my previous message about the Financial Advisor opportunity at Northwestern Mutual.\n\nI understand you're busy, but I truly believe this could be a great fit for your career goals.\n\nWould you have 15 minutes this week for a quick call?\n\nBest regards,\nNorthwestern Mutual Recruiting Team`,
      variables: ['first_name'],
      category: 'follow_up'
    },
    {
      name: 'SMS Initial Contact',
      channel: 'sms',
      subject: null,
      body_template: `Hi {{first_name}}, I'm reaching out from Northwestern Mutual about an exciting Financial Advisor opportunity. Would you be interested in learning more? Reply YES to continue.`,
      variables: ['first_name'],
      category: 'initial_outreach'
    },
    {
      name: 'LinkedIn Connection Request',
      channel: 'linkedin',
      subject: null,
      body_template: `Hi {{first_name}}, I'm impressed by your background in {{industry}}. I'm building Northwestern Mutual's advisory team in {{location}} and would love to connect to share an opportunity that aligns with your experience.`,
      variables: ['first_name', 'industry', 'location'],
      category: 'connection_request'
    }
  ];

  for (const template of templates) {
    await pool.query(
      `INSERT INTO outreach_templates 
       (name, channel, subject, body_template, variables, category)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (name) DO NOTHING`,
      [template.name, template.channel, template.subject, template.body_template, template.variables, template.category]
    );
  }
  
  console.log('Templates seeded successfully');
  process.exit(0);
}

seedTemplates().catch((err) => { console.error(err); process.exit(1); });














