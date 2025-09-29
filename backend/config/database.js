const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'northwestern_mutual_recruiting',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Increased for production stability
    statement_timeout: 30000, // 30 second query timeout
    query_timeout: 30000,
    application_name: 'northwestern_mutual_recruiting',
    // Enterprise-grade connection settings
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
});

// Enterprise-grade connection testing with retry logic
async function testConnection(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const client = await pool.connect();
            console.log('Database connected successfully');
            client.release();
            return true;
        } catch (err) {
            console.error(`Database connection attempt ${i + 1} failed:`, err.message);
            if (i === retries - 1) {
                console.error('❌ All database connection attempts failed. Using fallback mode.');
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // Exponential backoff
        }
    }
}

// Initialize connection
testConnection();

// Handle pool errors for production resilience
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client:', err);
    // Don't exit the process for production stability
});

// Enterprise-grade query wrapper with error handling and logging
async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;

        // Log slow queries for performance monitoring
        if (duration > 1000) {
            console.warn(`⚠️ Slow query detected (${duration}ms):`, text.substring(0, 100));
        }

        return result;
    } catch (error) {
        const duration = Date.now() - start;
        console.error(`❌ Database query failed after ${duration}ms:`, {
            error: error.message,
            query: text.substring(0, 100),
            stack: error.stack
        });
        throw error;
    }
}

module.exports = {
    query,
    pool,
    testConnection
};
