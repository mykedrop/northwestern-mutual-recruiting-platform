const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { generateTokens } = require('../config/auth');
const { validationResult } = require('express-validator');

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

module.exports = {
    register,
    login,
    refresh
};
