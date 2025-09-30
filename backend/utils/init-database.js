const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

async function initializeDatabase() {
    try {
        console.log('🔄 Checking database initialization...');

        // Check if tables exist
        const tableCheck = await query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'recruiters'
            );
        `);

        if (tableCheck.rows[0].exists) {
            console.log('✅ Database already initialized');
            return;
        }

        console.log('🔄 Initializing database schema...');

        // Read and execute the schema file
        const schemaPath = path.join(__dirname, 'database-setup.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Execute the schema (note: this will create the database if it doesn't exist)
        await query(schema);

        console.log('✅ Database schema initialized successfully');

        // Create default admin user
        const defaultUser = await query(`
            INSERT INTO recruiters (email, password_hash, first_name, last_name, role)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (email) DO NOTHING
            RETURNING id;
        `, [
            'admin@northwestern.com',
            '$2b$10$rQJ8kM6dZ4Nh8h5ZuN7N0OGjZGkZvZ4pJ4qN3mQ5rO7qP3nF1gH2K', // "password123"
            'Admin',
            'User',
            'admin'
        ]);

        if (defaultUser.rows.length > 0) {
            console.log('✅ Default admin user created: admin@northwestern.com / password123');
        }

    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        // Don't crash the app, just log the error
    }
}

module.exports = { initializeDatabase };