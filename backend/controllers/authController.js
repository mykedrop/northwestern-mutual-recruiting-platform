const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { generateTokens } = require('../config/auth');
const { validationResult } = require('express-validator');
const MFAService = require('../services/mfa.service');

const register = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, firstName, lastName } = req.body;
        
        // Check if user exists
        const existingUser = await db.query(
            'SELECT id FROM recruiters WHERE email = $1',
            [email]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Insert new recruiter
        const result = await db.query(
            `INSERT INTO recruiters (email, password_hash, first_name, last_name) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, email, first_name, last_name`,
            [email, passwordHash, firstName, lastName]
        );
        
        const user = result.rows[0];
        const tokens = generateTokens(user.id);
        
        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            },
            ...tokens
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Get user
        const result = await db.query(
            'SELECT * FROM recruiters WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        
        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Update last login
        await db.query(
            'UPDATE recruiters SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );
        
        const tokens = generateTokens(user.id);
        
        res.json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            },
            ...tokens
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
};

const refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }

        const { verifyToken } = require('../config/auth');
        const payload = verifyToken(refreshToken, 'refresh');

        const tokens = generateTokens(payload.userId);
        res.json(tokens);
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({ error: 'Invalid refresh token' });
    }
};

const logout = async (req, res) => {
    try {
        // In a more sophisticated implementation, you would invalidate the token
        // For now, we'll just send a success response
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
};

/**
 * MFA ENDPOINTS - Required for Northwestern Mutual Compliance
 */

const setupMFA = async (req, res) => {
    try {
        const userId = req.user.id;
        const userEmail = req.user.email;

        // Generate MFA secret
        const mfaData = await MFAService.generateMFASecret(userEmail);

        // Store MFA secret in database (encrypted)
        await db.query(
            'UPDATE recruiters SET mfa_secret = $1, mfa_backup_codes = $2 WHERE id = $3',
            [mfaData.secret, JSON.stringify(mfaData.backupCodes), userId]
        );

        res.json({
            secret: mfaData.secret,
            qrCode: mfaData.qrCode,
            backupCodes: mfaData.backupCodes,
            message: 'MFA setup initiated. Scan QR code with authenticator app.'
        });
    } catch (error) {
        console.error('MFA setup error:', error);
        res.status(500).json({ error: 'Failed to setup MFA' });
    }
};

const verifyMFA = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.id;

        // Get user's MFA secret
        const result = await db.query(
            'SELECT mfa_secret FROM recruiters WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { mfa_secret } = result.rows[0];

        if (!mfa_secret) {
            return res.status(400).json({ error: 'MFA not setup for this user' });
        }

        // Verify the token
        const isValid = MFAService.verifyMFAToken(token, mfa_secret);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid MFA token' });
        }

        // Enable MFA for user
        await db.query(
            'UPDATE recruiters SET mfa_enabled = true WHERE id = $1',
            [userId]
        );

        res.json({
            message: 'MFA verified and enabled successfully',
            mfaEnabled: true
        });
    } catch (error) {
        console.error('MFA verification error:', error);
        res.status(500).json({ error: 'Failed to verify MFA' });
    }
};

const loginWithMFA = async (req, res) => {
    try {
        const { email, password, mfaToken } = req.body;

        // Get user
        const result = await db.query(
            'SELECT * FROM recruiters WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if MFA is required
        if (user.mfa_enabled || MFAService.isMFARequired(user)) {
            if (!mfaToken) {
                return res.status(202).json({
                    requiresMFA: true,
                    message: 'MFA token required'
                });
            }

            // Verify MFA token
            const mfaValid = MFAService.verifyMFAToken(mfaToken, user.mfa_secret);
            if (!mfaValid) {
                return res.status(401).json({ error: 'Invalid MFA token' });
            }
        }

        // Update last login
        await db.query(
            'UPDATE recruiters SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        const tokens = generateTokens(user.id);

        res.json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                mfaEnabled: user.mfa_enabled
            },
            ...tokens
        });
    } catch (error) {
        console.error('MFA login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

const disableMFA = async (req, res) => {
    try {
        const { password, mfaToken } = req.body;
        const userId = req.user.id;

        // Get user data
        const result = await db.query(
            'SELECT * FROM recruiters WHERE id = $1',
            [userId]
        );

        const user = result.rows[0];

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Verify MFA token
        const mfaValid = MFAService.verifyMFAToken(mfaToken, user.mfa_secret);
        if (!mfaValid) {
            return res.status(401).json({ error: 'Invalid MFA token' });
        }

        // Disable MFA
        await db.query(
            'UPDATE recruiters SET mfa_enabled = false, mfa_secret = NULL, mfa_backup_codes = NULL WHERE id = $1',
            [userId]
        );

        res.json({ message: 'MFA disabled successfully' });
    } catch (error) {
        console.error('MFA disable error:', error);
        res.status(500).json({ error: 'Failed to disable MFA' });
    }
};

module.exports = {
    register,
    login,
    refresh,
    logout,
    setupMFA,
    verifyMFA,
    loginWithMFA,
    disableMFA,
    status: async (req, res) => {
        try {
            res.json({
                authenticated: !!req.user,
                user: req.user || null,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to check auth status' });
        }
    },
    profile: async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            res.json({
                user: req.user,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Profile error:', error);
            res.status(500).json({ error: 'Failed to get user profile' });
        }
    }
};
