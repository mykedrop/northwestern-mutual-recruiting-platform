const { verifyToken } = require('../config/auth');
const db = require('../config/database');

class AuthMiddleware {
    static async authenticate(req, res, next) {
        try {
            // Never use default in production
            if (process.env.NODE_ENV === 'production' && !req.headers.authorization) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Invalid authorization format' });
            }

            const token = authHeader.substring(7);
            const payload = verifyToken(token, 'access');

            // Load full user context with organization
            const userResult = await db.query(`
                SELECT
                    r.*,
                    o.slug as organization_slug,
                    o.settings as org_settings,
                    o.features as org_features,
                    t.name as team_name,
                    t.region as team_region
                FROM recruiters r
                LEFT JOIN organizations o ON r.organization_id = o.id
                LEFT JOIN teams t ON r.team_id = t.id
                WHERE r.id = $1 AND r.is_active = true
            `, [payload.userId]);

            if (userResult.rows.length === 0) {
                return res.status(401).json({ error: 'User not found or inactive' });
            }

            const user = userResult.rows[0];

            // Set PostgreSQL session variables for RLS
            await db.query(`SET LOCAL app.current_user_id = '${user.id}'`);
            await db.query(`SET LOCAL app.organization_id = '${user.organization_id}'`);

            req.user = {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                organizationId: user.organization_id,
                organizationSlug: user.organization_slug,
                teamId: user.team_id,
                teamName: user.team_name,
                permissions: user.permissions || {},
                features: user.org_features || {}
            };

            // Update last active
            db.query(
                'UPDATE recruiters SET last_active_at = NOW() WHERE id = $1',
                [user.id]
            ).catch(console.error);

            next();
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
            }
            console.error('Auth middleware error:', error);
            return res.status(401).json({ error: 'Authentication failed' });
        }
    }

    static requireRole(...allowedRoles) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            if (!allowedRoles.includes(req.user.role)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            next();
        };
    }

    static requirePermission(permission) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            if (req.user.role === 'admin') {
                return next(); // Admins bypass permission checks
            }

            if (!req.user.permissions[permission]) {
                return res.status(403).json({ error: `Missing required permission: ${permission}` });
            }

            next();
        };
    }
}

module.exports = AuthMiddleware;