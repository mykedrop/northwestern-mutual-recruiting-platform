const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();

/**
 * OAuth Routes for Northwestern Mutual Recruiting Platform
 * Supports Google and Microsoft/Azure AD authentication
 */

// Google OAuth Routes
router.get('/google',
    passport.authenticate('google', {
        scope: ['profile', 'email']
    })
);

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=oauth_failed' }),
    async (req, res) => {
        try {
            // Generate JWT tokens
            const accessToken = jwt.sign(
                {
                    userId: req.user.id,
                    email: req.user.email,
                    role: req.user.role,
                    organizationId: req.user.organization_id
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            const refreshToken = jwt.sign(
                {
                    userId: req.user.id,
                    type: 'refresh'
                },
                process.env.JWT_REFRESH_SECRET,
                { expiresIn: '7d' }
            );

            // Redirect to frontend with tokens
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
            res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}&refresh=${refreshToken}`);
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect('/login?error=token_generation_failed');
        }
    }
);

// Microsoft/Azure AD OAuth Routes
router.get('/microsoft',
    passport.authenticate('microsoft', {
        scope: ['user.read']
    })
);

router.get('/microsoft/callback',
    passport.authenticate('microsoft', { failureRedirect: '/login?error=oauth_failed' }),
    async (req, res) => {
        try {
            // Generate JWT tokens
            const accessToken = jwt.sign(
                {
                    userId: req.user.id,
                    email: req.user.email,
                    role: req.user.role,
                    organizationId: req.user.organization_id
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            const refreshToken = jwt.sign(
                {
                    userId: req.user.id,
                    type: 'refresh'
                },
                process.env.JWT_REFRESH_SECRET,
                { expiresIn: '7d' }
            );

            // Redirect to frontend with tokens
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
            res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}&refresh=${refreshToken}`);
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect('/login?error=token_generation_failed');
        }
    }
);

// Get current user info (for OAuth users)
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const db = require('../config/database');

        const user = await db.query(
            'SELECT id, email, first_name, last_name, role, organization_id, is_active FROM recruiters WHERE id = $1',
            [decoded.userId]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: user.rows[0],
            organization: {
                id: user.rows[0].organization_id,
                name: 'Northwestern Mutual'
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Logout route
router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

module.exports = router;