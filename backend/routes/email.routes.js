const express = require('express');
const router = express.Router();
const sgMail = require('@sendgrid/mail');
const db = require('../db');
const openAIService = require('../services/openai.service');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Create email campaign
router.post('/campaigns/create', async (req, res) => {
    try {
        const { 
            campaignName, 
            campaignType, 
            subjectLine, 
            emailTemplate,
            recipientFilters 
        } = req.body;

        const result = await db.query(
            `INSERT INTO email_campaigns 
            (campaign_name, campaign_type, subject_line, email_template, 
             recipient_filters, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
                campaignName,
                campaignType,
                subjectLine,
                emailTemplate,
                JSON.stringify(recipientFilters),
                req.user.id
            ]
        );

        res.json({
            success: true,
            campaign: result.rows[0]
        });
    } catch (error) {
        console.error('Campaign creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generate personalized email
router.post('/generate-email', async (req, res) => {
    try {
        const { candidateId, templateType } = req.body;
        
        // Fetch candidate data
        const candidateResult = await db.query(
            'SELECT * FROM candidates WHERE id = $1',
            [candidateId]
        );

        if (candidateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        const candidate = candidateResult.rows[0];
        
        const prompt = `
        Write a personalized ${templateType} email for a candidate:
        Name: ${candidate.first_name} ${candidate.last_name}
        Role: ${candidate.applied_role || 'Financial Advisor'}
        
        The email should be:
        - Professional but warm
        - Personalized to their background
        - Clear call-to-action
        - Under 200 words
        `;

        const response = await openAIService.openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                {
                    role: 'system',
                    content: 'You are a recruiter at Northwestern Mutual writing personalized emails.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 400
        });

        const emailContent = response.choices[0].message.content;

        res.json({
            success: true,
            email: emailContent
        });
    } catch (error) {
        console.error('Email generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send campaign
router.post('/campaigns/:campaignId/send', async (req, res) => {
    try {
        const { campaignId } = req.params;
        
        // Get campaign details
        const campaignResult = await db.query(
            'SELECT * FROM email_campaigns WHERE id = $1',
            [campaignId]
        );

        if (campaignResult.rows.length === 0) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const campaign = campaignResult.rows[0];
        
        // Get recipients based on filters
        const recipientsResult = await db.query(
            `SELECT * FROM candidates 
             WHERE status = 'active' 
             LIMIT 100` // Limit for safety
        );

        const sendPromises = recipientsResult.rows.map(async (recipient) => {
            // Personalize content
            const personalizedContent = campaign.email_template
                .replace('{{first_name}}', recipient.first_name)
                .replace('{{last_name}}', recipient.last_name)
                .replace('{{role}}', recipient.applied_role || 'the role');

            const msg = {
                to: recipient.email,
                from: 'recruiting@northwesternmutual.com',
                subject: campaign.subject_line,
                html: personalizedContent
            };

            try {
                await sgMail.send(msg);
                
                // Record sent email
                await db.query(
                    `INSERT INTO email_campaign_recipients 
                    (campaign_id, candidate_id, email_address, personalized_content, status)
                    VALUES ($1, $2, $3, $4, $5)`,
                    [campaignId, recipient.id, recipient.email, personalizedContent, 'sent']
                );
                
                return { success: true, email: recipient.email };
            } catch (error) {
                console.error(`Failed to send to ${recipient.email}:`, error);
                return { success: false, email: recipient.email, error: error.message };
            }
        });

        const results = await Promise.all(sendPromises);
        
        // Update campaign stats
        const sentCount = results.filter(r => r.success).length;
        await db.query(
            'UPDATE email_campaigns SET sent_count = $1, status = $2 WHERE id = $3',
            [sentCount, 'sent', campaignId]
        );

        res.json({
            success: true,
            sent: sentCount,
            failed: results.length - sentCount,
            results: results
        });
    } catch (error) {
        console.error('Campaign send error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;













