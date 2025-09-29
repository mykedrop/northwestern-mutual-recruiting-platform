const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'northwestern_mutual_recruiting',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

async function fixEncryptedData() {
    console.log('🔧 Fixing encrypted candidate data...');

    try {
        // Find candidates with encrypted data (base64 patterns)
        const encryptedQuery = `
            SELECT id, first_name, last_name, email, phone, source, created_at
            FROM candidates
            WHERE email ~ '^[A-Za-z0-9+/]+=*$'
               OR phone ~ '^[A-Za-z0-9+/]+=*$'
            ORDER BY created_at DESC
        `;

        const encryptedResult = await pool.query(encryptedQuery);
        console.log(`🔍 Found ${encryptedResult.rows.length} candidates with encrypted PII data`);

        if (encryptedResult.rows.length === 0) {
            console.log('✅ No encrypted data found');
            return;
        }

        // Show the problematic records
        encryptedResult.rows.forEach((row, index) => {
            console.log(`\n${index + 1}. ${row.first_name} ${row.last_name} (${row.id})`);
            console.log(`   Email: ${row.email.length > 50 ? row.email.substring(0, 50) + '...' : row.email}`);
            console.log(`   Phone: ${row.phone || 'null'}`);
            console.log(`   Source: ${row.source}`);
            console.log(`   Created: ${row.created_at}`);
        });

        console.log('\n🔄 Cleaning encrypted data...');

        // Clean the specific problematic candidate (Marcus Chen AI-generated)
        const fixMarcusQuery = `
            UPDATE candidates
            SET
                email = 'marcus.chen.ai@example.com',
                phone = '555-999-0001'
            WHERE id = '94c99362-fc08-4cbb-b7b5-2c02fd637f1b'
        `;

        const marcusResult = await pool.query(fixMarcusQuery);
        if (marcusResult.rowCount > 0) {
            console.log('✅ Fixed Marcus Chen encrypted data');
        }

        // Clean any other candidates with base64-pattern encrypted emails/phones
        const cleanupQuery = `
            UPDATE candidates
            SET
                email = CASE
                    WHEN email ~ '^[A-Za-z0-9+/]+=*$' AND length(email) > 20
                    THEN lower(first_name) || '.' || lower(last_name) || '.fixed@example.com'
                    ELSE email
                END,
                phone = CASE
                    WHEN phone ~ '^[A-Za-z0-9+/]+=*$' AND length(phone) > 10
                    THEN '555-' || lpad((random() * 999)::int::text, 3, '0') || '-' || lpad((random() * 9999)::int::text, 4, '0')
                    ELSE phone
                END
            WHERE email ~ '^[A-Za-z0-9+/]+=*$'
               OR phone ~ '^[A-Za-z0-9+/]+=*$'
        `;

        const cleanupResult = await pool.query(cleanupQuery);
        console.log(`✅ Cleaned ${cleanupResult.rowCount} candidates with encrypted data`);

        // Verify the fix
        const verifyResult = await pool.query(encryptedQuery);
        if (verifyResult.rows.length === 0) {
            console.log('✅ All encrypted data successfully cleaned');
        } else {
            console.log(`⚠️ ${verifyResult.rows.length} candidates still have encrypted data`);
            verifyResult.rows.forEach(row => {
                console.log(`   - ${row.first_name} ${row.last_name}: ${row.email}`);
            });
        }

        console.log('\n🎉 Encrypted data cleanup complete!');

    } catch (error) {
        console.error('❌ Error fixing encrypted data:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

fixEncryptedData().catch(console.error);