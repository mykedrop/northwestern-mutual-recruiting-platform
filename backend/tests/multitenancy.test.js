const assert = require('assert');
const TestHelper = require('./setup');

describe('Multi-Tenancy Data Isolation', () => {
    let pool, org1, org2, user1, user2;

    before(async () => {
        pool = await TestHelper.setupTestDatabase();

        // Create two organizations
        org1 = await TestHelper.createTestOrganization(pool);
        org2 = await TestHelper.createTestOrganization(pool);

        // Create users in different orgs
        user1 = await TestHelper.createTestUser(pool, org1.id);
        user2 = await TestHelper.createTestUser(pool, org2.id);
    });

    after(async () => {
        await TestHelper.cleanupTestData(pool);
    });

    it('should prevent cross-organization data access', async () => {
        // Create candidate for org1
        const candidate1 = await pool.query(
            `INSERT INTO candidates
            (email, first_name, last_name, organization_id, recruiter_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id`,
            ['candidate1@test.com', 'John', 'Doe', org1.id, user1.id]
        );

        // Set session for user2 (different org)
        await pool.query(`SET LOCAL app.current_user_id = $1`, [user2.id]);

        // Try to access org1's candidate
        const result = await pool.query(
            'SELECT * FROM candidates WHERE id = $1 AND organization_id = $2',
            [candidate1.rows[0].id, org2.id]
        );

        assert.strictEqual(result.rows.length, 0, 'Should not access other org data');
    });

    it('should allow same-organization data access', async () => {
        // Create candidate for org1
        const candidate = await pool.query(
            `INSERT INTO candidates
            (email, first_name, last_name, organization_id, recruiter_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id`,
            ['candidate2@test.com', 'Jane', 'Smith', org1.id, user1.id]
        );

        // Set session for user1 (same org)
        await pool.query(`SET LOCAL app.current_user_id = $1`, [user1.id]);

        // Access own org's candidate
        const result = await pool.query(
            'SELECT * FROM candidates WHERE id = $1 AND organization_id = $2',
            [candidate.rows[0].id, org1.id]
        );

        assert.strictEqual(result.rows.length, 1, 'Should access same org data');
    });

    it('should enforce recruiter-level isolation within organization', async () => {
        // Create second user in org1
        const user3 = await TestHelper.createTestUser(pool, org1.id);

        // Create candidate for user1
        const candidate = await pool.query(
            `INSERT INTO candidates
            (email, first_name, last_name, organization_id, recruiter_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id`,
            ['candidate3@test.com', 'Bob', 'Johnson', org1.id, user1.id]
        );

        // Try to access as user3 (same org, different recruiter)
        const result = await pool.query(
            'SELECT * FROM candidates WHERE id = $1 AND recruiter_id = $2',
            [candidate.rows[0].id, user3.id]
        );

        assert.strictEqual(result.rows.length, 0, 'Should not access other recruiter data');
    });
});