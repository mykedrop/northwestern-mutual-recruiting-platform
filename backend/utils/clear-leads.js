const db = require('../config/database');

async function clearLeads() {
    console.log('WARNING: This will delete all candidates and related data.');
    try {
        // Use a transaction to ensure atomicity
        await db.query('BEGIN');

        // Prefer TRUNCATE with CASCADE to drop dependent rows quickly
        // Note: TRUNCATE affects tables; CASCADE will include referencing tables
        // that have foreign keys to candidates, such as assessments, pipelines, etc.
        await db.query(`
            TRUNCATE TABLE 
              candidates 
            CASCADE;
        `);

        // Also clear AI sourcing tables if present
        await db.query(`
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables 
                           WHERE table_name = 'sourced_candidates') THEN
                    EXECUTE 'TRUNCATE TABLE sourced_candidates CASCADE';
                END IF;
            END $$;
        `);

        await db.query('COMMIT');
        console.log('All candidates (leads) and dependent records have been removed.');
        process.exit(0);
    } catch (error) {
        console.error('Clear leads failed:', error);
        try { await db.query('ROLLBACK'); } catch (_) {}
        process.exit(1);
    }
}

clearLeads();


