const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class TestHelper {
    static async setupTestDatabase() {
        const pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: 5432,
            database: 'northwestern_mutual_test',
            user: process.env.DB_USER || 'mikeweingarten',
            password: process.env.DB_PASSWORD || ''
        });

        // Run migrations
        const migrations = require('fs').readFileSync(
            require('path').join(__dirname, '../migrations/010_multi_tenancy.sql'),
            'utf8'
        );

        await pool.query(migrations);
        return pool;
    }

    static async createTestOrganization(pool) {
        const org = {
            id: uuidv4(),
            name: 'Test Organization',
            slug: 'test-org-' + Date.now()
        };

        await pool.query(
            'INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)',
            [org.id, org.name, org.slug]
        );

        return org;
    }

    static async createTestUser(pool, orgId, role = 'recruiter') {
        const user = {
            id: uuidv4(),
            email: `test-${Date.now()}@test.com`,
            password: 'TestPassword123!',
            firstName: 'Test',
            lastName: 'User',
            organizationId: orgId,
            role: role
        };

        const passwordHash = await bcrypt.hash(user.password, 10);

        await pool.query(
            `INSERT INTO recruiters
            (id, email, password_hash, first_name, last_name, organization_id, role)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [user.id, user.email, passwordHash, user.firstName, user.lastName, orgId, role]
        );

        return user;
    }

    static async cleanupTestData(pool) {
        await pool.query("DELETE FROM organizations WHERE slug LIKE 'test-org-%'");
        await pool.end();
    }
}

module.exports = TestHelper;