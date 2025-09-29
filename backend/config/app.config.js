require('dotenv').config();

const config = {
    app: {
        name: 'Northwestern Mutual Recruiting Platform',
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT || '3001'),
        socketPort: parseInt(process.env.SOCKET_PORT || '3002'),
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        apiUrl: process.env.API_URL || 'http://localhost:3001',
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30') * 60 * 1000
    },

    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        name: process.env.DB_NAME || 'northwestern_mutual_recruiting',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20, // connection pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    },

    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0'),
        retryStrategy: (times) => Math.min(times * 50, 2000)
    },

    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    },

    security: {
        bcryptRounds: 12,
        maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
        lockoutDuration: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '30') * 60 * 1000,
        requireMFA: process.env.REQUIRE_MFA === 'true',
        piiEncryptionKey: process.env.PII_ENCRYPTION_KEY,
        auditEncryptionKey: process.env.AUDIT_ENCRYPTION_KEY
    },

    features: {
        enableAI: process.env.ENABLE_AI_FEATURES !== 'false',
        enableExport: process.env.ENABLE_EXPORT !== 'false',
        enableSourcing: process.env.ENABLE_SOURCING !== 'false',
        maintenanceMode: process.env.MAINTENANCE_MODE === 'true'
    },

    cors: {
        origin: function(origin, callback) {
            const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

            if (process.env.NODE_ENV === 'development') {
                return callback(null, true);
            }

            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        optionsSuccessStatus: 200
    }
};

// Validate required configuration
const requiredEnvVars = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'PII_ENCRYPTION_KEY',
    'AUDIT_ENCRYPTION_KEY'
];

if (process.env.NODE_ENV === 'production') {
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            console.error(`Missing required environment variable: ${envVar}`);
            process.exit(1);
        }
    }
}

module.exports = config;