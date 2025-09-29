const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

router.get('/status', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await db.query(`
            SELECT integration_id, account_info, connected_at
            FROM user_integrations
            WHERE user_id = $1
        `, [userId]);

        const integrations = [
            { id: 'google-calendar', name: 'Google Calendar', connected: false },
            { id: 'gmail', name: 'Gmail', connected: false },
            { id: 'google-drive', name: 'Google Drive', connected: false },
            { id: 'outlook', name: 'Outlook', connected: false },
            { id: 'slack', name: 'Slack', connected: false },
            { id: 'linkedin', name: 'LinkedIn', connected: false },
            { id: 'indeed', name: 'Indeed', connected: false, category: 'job-boards' },
            { id: 'ziprecruiter', name: 'ZipRecruiter', connected: false, category: 'job-boards' }
        ];

        result.rows.forEach(row => {
            const integration = integrations.find(i => i.id === row.integration_id);
            if (integration) {
                integration.connected = true;
                integration.accountInfo = row.account_info;
                integration.connectedAt = row.connected_at;
            }
        });

        res.json({ success: true, integrations });
    } catch (error) {
        console.error('Get integrations status error:', error);
        res.status(500).json({ error: 'Failed to get integrations status' });
    }
});

router.post('/:integrationId/connect', authMiddleware, async (req, res) => {
    try {
        const { integrationId } = req.params;
        const userId = req.user.userId;

        const integrationNames = {
            'google-calendar': 'Google Calendar',
            'gmail': 'Gmail',
            'google-drive': 'Google Drive',
            'outlook': 'Outlook',
            'slack': 'Slack',
            'linkedin': 'LinkedIn',
            'indeed': 'Indeed',
            'ziprecruiter': 'ZipRecruiter'
        };

        const hasOAuthConfig = process.env.GOOGLE_CLIENT_ID &&
                               process.env.MICROSOFT_CLIENT_ID &&
                               process.env.SLACK_CLIENT_ID;

        if (hasOAuthConfig) {
            const oauthUrls = {
                'google-calendar': `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/calendar`,
                'gmail': `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/gmail.send`,
                'google-drive': `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/drive.file`,
                'outlook': `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${process.env.MICROSOFT_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.MICROSOFT_REDIRECT_URI)}&response_type=code&scope=https://graph.microsoft.com/Mail.Send%20https://graph.microsoft.com/Calendars.ReadWrite`,
                'slack': `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=chat:write,channels:read&redirect_uri=${encodeURIComponent(process.env.SLACK_REDIRECT_URI)}`,
                'linkedin': `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.LINKEDIN_REDIRECT_URI)}&scope=r_liteprofile%20r_emailaddress%20w_member_social`
            };

            if (oauthUrls[integrationId]) {
                await db.query(`
                    INSERT INTO user_integrations (user_id, integration_id, status)
                    VALUES ($1, $2, 'pending')
                    ON CONFLICT (user_id, integration_id)
                    DO UPDATE SET status = 'pending', updated_at = NOW()
                `, [userId, integrationId]);

                res.json({
                    success: true,
                    authUrl: oauthUrls[integrationId]
                });
            }
        } else {
            const userEmail = req.user.email || 'user@example.com';
            const accountInfo = integrationId.includes('google') ? userEmail :
                              integrationId === 'outlook' ? userEmail :
                              integrationId === 'slack' ? 'Workspace Connected' :
                              integrationId === 'linkedin' ? 'Profile Connected' : userEmail;

            await db.query(`
                INSERT INTO user_integrations (user_id, integration_id, status, account_info, connected_at)
                VALUES ($1, $2, 'connected', $3, NOW())
                ON CONFLICT (user_id, integration_id)
                DO UPDATE SET status = 'connected', account_info = $3, connected_at = NOW(), updated_at = NOW()
            `, [userId, integrationId, accountInfo]);

            res.json({
                success: true,
                message: `${integrationNames[integrationId]} connected successfully`,
                mock: true
            });
        }
    } catch (error) {
        console.error('Connect integration error:', error);
        res.status(500).json({ error: 'Failed to connect integration' });
    }
});

router.post('/:integrationId/disconnect', authMiddleware, async (req, res) => {
    try {
        const { integrationId } = req.params;
        const userId = req.user.userId;

        await db.query(`
            DELETE FROM user_integrations
            WHERE user_id = $1 AND integration_id = $2
        `, [userId, integrationId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Disconnect integration error:', error);
        res.status(500).json({ error: 'Failed to disconnect integration' });
    }
});

router.get('/oauth/callback', async (req, res) => {
    try {
        const { code, state } = req.query;

        res.redirect('/settings?connected=true');
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect('/settings?error=auth_failed');
    }
});

module.exports = router;