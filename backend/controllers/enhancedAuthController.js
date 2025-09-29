const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const db = require('../config/database');
const { generateTokens, verifyToken } = require('../config/auth');
const { validationResult } = require('express-validator');
const auditLogger = require('../services/auditLogger.service');

class EnhancedAuthController {
    // Enhanced password strength validation
    validatePasswordStrength(password) {
        const errors = [];

        if (password.length < 12) {
            errors.push('Password must be at least 12 characters long');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        // Check against common passwords
        const commonPasswords = [
            'password123', '123456789', 'qwerty123', 'admin123',
            'password1', 'letmein123', 'welcome123', 'password!',
            'Password123', 'Password123!', 'northwestern'
        ];

        if (commonPasswords.some(common => password.toLowerCase().includes(common.toLowerCase()))) {
            errors.push('Password contains common patterns that are not allowed');
        }

        return errors;
    }

    // Account lockout mechanism
    async checkAccountLockout(email) {
        const result = await db.query(
            `SELECT failed_attempts, locked_until, last_failed_attempt
             FROM recruiters
             WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return { isLocked: false };
        }

        const user = result.rows[0];
        const now = new Date();

        // If account is locked and lockout period hasn't expired
        if (user.locked_until && new Date(user.locked_until) > now) {
            const remainingTime = Math.ceil((new Date(user.locked_until) - now) / 1000 / 60);
            return {
                isLocked: true,
                remainingMinutes: remainingTime
            };
        }

        // Reset lockout if enough time has passed
        if (user.locked_until && new Date(user.locked_until) <= now) {
            await db.query(
                `UPDATE recruiters
                 SET failed_attempts = 0, locked_until = NULL
                 WHERE email = $1`,
                [email]
            );
        }

        return { isLocked: false, failedAttempts: user.failed_attempts || 0 };
    }

    async incrementFailedAttempts(email) {
        const maxAttempts = 5;
        const lockoutDuration = 30; // minutes

        const result = await db.query(
            `UPDATE recruiters
             SET failed_attempts = COALESCE(failed_attempts, 0) + 1,
                 last_failed_attempt = CURRENT_TIMESTAMP,
                 locked_until = CASE
                     WHEN COALESCE(failed_attempts, 0) + 1 >= $1
                     THEN CURRENT_TIMESTAMP + INTERVAL '${lockoutDuration} minutes'
                     ELSE locked_until
                 END
             WHERE email = $2
             RETURNING failed_attempts, locked_until`,
            [maxAttempts, email]
        );

        return result.rows[0];
    }

    async resetFailedAttempts(email) {
        await db.query(
            `UPDATE recruiters
             SET failed_attempts = 0, locked_until = NULL
             WHERE email = $1`,
            [email]
        );
    }

    // Session management
    async createSession(userId, ipAddress, userAgent) {
        const sessionId = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session

        await db.query(
            `INSERT INTO user_sessions (session_id, user_id, ip_address, user_agent, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [sessionId, userId, ipAddress, userAgent, expiresAt]
        );

        // Log session creation
        await auditLogger.logSession(sessionId, userId, null, ipAddress, userAgent, 'SESSION_CREATE');

        return sessionId;
    }

    async validateSession(sessionId) {
        const result = await db.query(
            `SELECT user_id, expires_at, is_active
             FROM user_sessions
             WHERE session_id = $1`,
            [sessionId]
        );

        if (result.rows.length === 0) {
            return { valid: false, reason: 'Session not found' };
        }

        const session = result.rows[0];

        if (!session.is_active) {
            return { valid: false, reason: 'Session deactivated' };
        }

        if (new Date(session.expires_at) < new Date()) {
            await this.invalidateSession(sessionId);
            return { valid: false, reason: 'Session expired' };
        }

        // Update last activity
        await db.query(
            `UPDATE user_sessions
             SET last_activity = CURRENT_TIMESTAMP
             WHERE session_id = $1`,
            [sessionId]
        );

        return { valid: true, userId: session.user_id };
    }

    async invalidateSession(sessionId) {
        await db.query(
            `UPDATE user_sessions
             SET is_active = FALSE, logged_out_at = CURRENT_TIMESTAMP
             WHERE session_id = $1`,
            [sessionId]
        );

        await auditLogger.logEvent({
            eventType: 'SESSION_INVALIDATED',
            eventCategory: 'SECURITY',
            action: 'SESSION_LOGOUT',
            details: { sessionId },
            riskLevel: 'LOW'
        });
    }

    // Enhanced registration with additional security
    async register(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { email, password, firstName, lastName, department, role } = req.body;

            // Enhanced password validation
            const passwordErrors = this.validatePasswordStrength(password);
            if (passwordErrors.length > 0) {
                return res.status(400).json({
                    error: 'Password does not meet security requirements',
                    details: passwordErrors
                });
            }

            // Check if user exists
            const existingUser = await db.query(
                'SELECT id FROM recruiters WHERE email = $1',
                [email]
            );

            if (existingUser.rows.length > 0) {
                await auditLogger.logEvent({
                    eventType: 'REGISTRATION_ATTEMPT',
                    eventCategory: 'SECURITY',
                    userEmail: email,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    action: 'DUPLICATE_EMAIL',
                    details: { email },
                    riskLevel: 'MEDIUM'
                });

                return res.status(409).json({ error: 'Email already registered' });
            }

            // Enhanced password hashing with higher cost
            const saltRounds = 14; // Increased from 10 for better security
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // Generate email verification token
            const emailVerificationToken = crypto.randomBytes(32).toString('hex');
            const emailVerificationExpiry = new Date();
            emailVerificationExpiry.setHours(emailVerificationExpiry.getHours() + 24);

            // Insert new recruiter with additional security fields
            const result = await db.query(
                `INSERT INTO recruiters (
                    email, password_hash, first_name, last_name, department, role,
                    email_verification_token, email_verification_expires,
                    password_changed_at, account_status, created_by_ip
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, 'pending_verification', $9)
                RETURNING id, email, first_name, last_name, department, role`,
                [email, passwordHash, firstName, lastName, department || 'recruiting',
                 role || 'recruiter', emailVerificationToken, emailVerificationExpiry, req.ip]
            );

            const user = result.rows[0];

            // Create session
            const sessionId = await this.createSession(user.id, req.ip, req.get('User-Agent'));

            // Generate tokens
            const tokens = generateTokens(user.id);

            // Log successful registration
            await auditLogger.logEvent({
                eventType: 'USER_REGISTRATION',
                eventCategory: 'SECURITY',
                userId: user.id,
                userEmail: email,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                sessionId,
                action: 'REGISTER',
                details: {
                    firstName,
                    lastName,
                    department: department || 'recruiting',
                    role: role || 'recruiter'
                },
                riskLevel: 'MEDIUM',
                complianceFlags: ['SOX', 'USER_MANAGEMENT']
            });

            res.status(201).json({
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    department: user.department,
                    role: user.role,
                    requiresEmailVerification: true
                },
                sessionId,
                ...tokens
            });
        } catch (error) {
            console.error('Registration error:', error);
            await auditLogger.logEvent({
                eventType: 'REGISTRATION_ERROR',
                eventCategory: 'SECURITY',
                userEmail: req.body.email,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                action: 'REGISTER_FAILED',
                details: { error: error.message },
                riskLevel: 'HIGH'
            });

            res.status(500).json({ error: 'Failed to register user' });
        }
    }

    // Enhanced login with security features
    async login(req, res) {
        try {
            const { email, password, mfaCode } = req.body;
            const ipAddress = req.ip;
            const userAgent = req.get('User-Agent');

            // Check account lockout
            const lockoutStatus = await this.checkAccountLockout(email);
            if (lockoutStatus.isLocked) {
                await auditLogger.logAuthentication(
                    null, email, ipAddress, userAgent, 'LOGIN_BLOCKED', false,
                    { reason: 'Account locked', remainingMinutes: lockoutStatus.remainingMinutes }
                );

                return res.status(423).json({
                    error: 'Account temporarily locked due to too many failed attempts',
                    remainingMinutes: lockoutStatus.remainingMinutes
                });
            }

            // Get user with security fields
            const result = await db.query(
                `SELECT id, email, password_hash, first_name, last_name, department, role,
                        mfa_enabled, mfa_secret, account_status, failed_attempts, last_login,
                        email_verified, password_changed_at
                 FROM recruiters
                 WHERE email = $1`,
                [email]
            );

            if (result.rows.length === 0) {
                await this.incrementFailedAttempts(email);
                await auditLogger.logAuthentication(
                    null, email, ipAddress, userAgent, 'LOGIN_FAILED', false,
                    { reason: 'User not found' }
                );

                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const user = result.rows[0];

            // Check account status
            if (user.account_status !== 'active' && user.account_status !== 'pending_verification') {
                await auditLogger.logAuthentication(
                    user.id, email, ipAddress, userAgent, 'LOGIN_BLOCKED', false,
                    { reason: 'Account status', status: user.account_status }
                );

                return res.status(403).json({
                    error: 'Account access restricted',
                    status: user.account_status
                });
            }

            // Verify password
            const isValid = await bcrypt.compare(password, user.password_hash);
            if (!isValid) {
                await this.incrementFailedAttempts(email);
                await auditLogger.logAuthentication(
                    user.id, email, ipAddress, userAgent, 'LOGIN_FAILED', false,
                    { reason: 'Invalid password', failedAttempts: (user.failed_attempts || 0) + 1 }
                );

                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Check MFA if enabled
            if (user.mfa_enabled) {
                if (!mfaCode) {
                    return res.status(200).json({
                        requiresMFA: true,
                        tempToken: this.generateTempToken(user.id)
                    });
                }

                const isValidMFA = speakeasy.totp.verify({
                    secret: user.mfa_secret,
                    encoding: 'base32',
                    token: mfaCode,
                    window: 2 // Allow 60 seconds drift
                });

                if (!isValidMFA) {
                    await auditLogger.logAuthentication(
                        user.id, email, ipAddress, userAgent, 'MFA_FAILED', false,
                        { reason: 'Invalid MFA code' }
                    );

                    return res.status(401).json({ error: 'Invalid MFA code' });
                }
            }

            // Check password age (force change if older than 90 days)
            const passwordAge = new Date() - new Date(user.password_changed_at);
            const maxPasswordAge = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds

            const requiresPasswordChange = passwordAge > maxPasswordAge;

            // Reset failed attempts on successful login
            await this.resetFailedAttempts(email);

            // Update last login
            await db.query(
                'UPDATE recruiters SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );

            // Create session
            const sessionId = await this.createSession(user.id, ipAddress, userAgent);

            // Generate tokens with UUID support
            const tokens = generateTokens(user.id.toString());

            // Log successful login
            await auditLogger.logAuthentication(
                user.id, email, ipAddress, userAgent, 'LOGIN_SUCCESS', true,
                { sessionId, mfaUsed: user.mfa_enabled }
            );

            res.json({
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    department: user.department,
                    role: user.role,
                    mfaEnabled: user.mfa_enabled,
                    emailVerified: user.email_verified,
                    requiresPasswordChange
                },
                sessionId,
                ...tokens
            });
        } catch (error) {
            console.error('Login error:', error);
            await auditLogger.logEvent({
                eventType: 'LOGIN_ERROR',
                eventCategory: 'SECURITY',
                userEmail: req.body.email,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                action: 'LOGIN_SYSTEM_ERROR',
                details: { error: error.message },
                riskLevel: 'HIGH'
            });

            res.status(500).json({ error: 'Login system error' });
        }
    }

    // Enhanced token refresh with session validation
    async refresh(req, res) {
        try {
            const { refreshToken, sessionId } = req.body;

            if (!refreshToken) {
                return res.status(401).json({ error: 'Refresh token required' });
            }

            // Validate session if provided
            if (sessionId) {
                const sessionValidation = await this.validateSession(sessionId);
                if (!sessionValidation.valid) {
                    return res.status(401).json({
                        error: 'Invalid session',
                        reason: sessionValidation.reason
                    });
                }
            }

            const payload = verifyToken(refreshToken, 'refresh');

            // Generate new tokens
            const tokens = generateTokens(payload.userId);

            await auditLogger.logEvent({
                eventType: 'TOKEN_REFRESH',
                eventCategory: 'SECURITY',
                userId: payload.userId,
                sessionId,
                action: 'REFRESH_TOKEN',
                details: { sessionId },
                riskLevel: 'LOW'
            });

            res.json(tokens);
        } catch (error) {
            console.error('Token refresh error:', error);
            await auditLogger.logEvent({
                eventType: 'TOKEN_REFRESH_ERROR',
                eventCategory: 'SECURITY',
                action: 'REFRESH_FAILED',
                details: { error: error.message },
                riskLevel: 'MEDIUM'
            });

            res.status(401).json({ error: 'Invalid refresh token' });
        }
    }

    // Enhanced logout with session cleanup
    async logout(req, res) {
        try {
            const { sessionId } = req.body;
            const userId = req.user?.id;

            if (sessionId) {
                await this.invalidateSession(sessionId);
            }

            await auditLogger.logAuthentication(
                userId, req.user?.email, req.ip, req.get('User-Agent'),
                'LOGOUT', true, { sessionId }
            );

            res.json({ message: 'Logged out successfully' });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({ error: 'Logout failed' });
        }
    }

    // Generate temporary token for MFA flow
    generateTempToken(userId) {
        return crypto.createHmac('sha256', process.env.JWT_ACCESS_SECRET)
            .update(`${userId}-${Date.now()}`)
            .digest('hex');
    }

    // Password change with enhanced security
    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user.id;

            // Validate new password strength
            const passwordErrors = this.validatePasswordStrength(newPassword);
            if (passwordErrors.length > 0) {
                return res.status(400).json({
                    error: 'New password does not meet security requirements',
                    details: passwordErrors
                });
            }

            // Get current user data
            const result = await db.query(
                'SELECT password_hash FROM recruiters WHERE id = $1',
                [userId]
            );

            const user = result.rows[0];

            // Verify current password
            const isValid = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isValid) {
                await auditLogger.logEvent({
                    eventType: 'PASSWORD_CHANGE_FAILED',
                    eventCategory: 'SECURITY',
                    userId,
                    action: 'INVALID_CURRENT_PASSWORD',
                    riskLevel: 'HIGH'
                });

                return res.status(401).json({ error: 'Current password is incorrect' });
            }

            // Hash new password
            const saltRounds = 14;
            const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

            // Update password
            await db.query(
                `UPDATE recruiters
                 SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP,
                     failed_attempts = 0, locked_until = NULL
                 WHERE id = $2`,
                [newPasswordHash, userId]
            );

            // Invalidate all sessions for this user except current
            await db.query(
                `UPDATE user_sessions
                 SET is_active = FALSE
                 WHERE user_id = $1 AND session_id != $2`,
                [userId, req.body.sessionId]
            );

            await auditLogger.logEvent({
                eventType: 'PASSWORD_CHANGED',
                eventCategory: 'SECURITY',
                userId,
                action: 'CHANGE_PASSWORD',
                riskLevel: 'MEDIUM',
                complianceFlags: ['SOX', 'PASSWORD_POLICY']
            });

            res.json({ message: 'Password changed successfully' });
        } catch (error) {
            console.error('Password change error:', error);
            res.status(500).json({ error: 'Failed to change password' });
        }
    }
}

module.exports = new EnhancedAuthController();