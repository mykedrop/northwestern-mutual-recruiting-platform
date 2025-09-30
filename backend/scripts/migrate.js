#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Migration tracking table
const createMigrationTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(255) PRIMARY KEY,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    await pool.query(query);
    console.log('✅ Migration tracking table ready');
};

// Get executed migrations
const getExecutedMigrations = async () => {
    const result = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
    return result.rows.map(row => row.version);
};

// Record migration execution
const recordMigration = async (version) => {
    await pool.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
};

// Get pending migrations
const getPendingMigrations = async () => {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const allMigrations = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

    const executed = await getExecutedMigrations();
    const pending = allMigrations.filter(migration => {
        const version = migration.replace('.sql', '');
        return !executed.includes(version);
    });

    return pending;
};

// Execute a single migration
const executeMigration = async (migrationFile) => {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const migrationPath = path.join(migrationsDir, migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const version = migrationFile.replace('.sql', '');

    console.log(`🔄 Executing migration: ${migrationFile}`);

    try {
        // Execute migration in a transaction
        await pool.query('BEGIN');
        await pool.query(sql);
        await recordMigration(version);
        await pool.query('COMMIT');

        console.log(`✅ Completed migration: ${migrationFile}`);
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error(`❌ Failed migration: ${migrationFile}`, error.message);
        throw error;
    }
};

// Main migration function
const runMigrations = async () => {
    try {
        console.log('🚀 Starting Northwestern Mutual database migrations...');

        // Ensure migration table exists
        await createMigrationTable();

        // Get pending migrations
        const pending = await getPendingMigrations();

        if (pending.length === 0) {
            console.log('✅ No pending migrations found. Database is up to date.');
            return;
        }

        console.log(`📋 Found ${pending.length} pending migrations:`);
        pending.forEach(migration => console.log(`   - ${migration}`));

        // Execute each migration
        for (const migration of pending) {
            await executeMigration(migration);
        }

        console.log('🎉 All migrations completed successfully!');

        // Verify critical tables exist
        const criticalTables = ['organizations', 'recruiters', 'candidates', 'assessments'];
        for (const table of criticalTables) {
            const result = await pool.query(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
                [table]
            );
            if (result.rows[0].exists) {
                console.log(`✅ Verified table: ${table}`);
            } else {
                console.error(`❌ Missing critical table: ${table}`);
            }
        }

    } catch (error) {
        console.error('💥 Migration failed:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
};

// Handle script execution
if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };