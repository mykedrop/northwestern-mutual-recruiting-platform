const { verifyToken } = require('../config/auth');

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const token = authHeader.split(' ')[1]; // Bearer <token>
        
        if (!token) {
            return res.status(401).json({ error: 'Invalid token format' });
        }
        
        const payload = verifyToken(token, 'access');
        req.user = payload;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
};

module.exports = authMiddleware;
