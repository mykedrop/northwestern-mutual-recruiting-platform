const request = require('supertest');
const app = require('../server');
const TestHelper = require('./setup');

describe('Authentication System', () => {
    let pool, org, user;

    before(async () => {
        pool = await TestHelper.setupTestDatabase();
        org = await TestHelper.createTestOrganization(pool);
        user = await TestHelper.createTestUser(pool, org.id);
    });

    after(async () => {
        await TestHelper.cleanupTestData(pool);
    });

    describe('POST /api/auth/login', () => {
        it('should login with valid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: user.email,
                    password: user.password
                })
                .expect(200);

            assert(res.body.accessToken, 'Should return access token');
            assert(res.body.refreshToken, 'Should return refresh token');
            assert.strictEqual(res.body.user.email, user.email);
        });

        it('should reject invalid credentials', async () => {
            await request(app)
                .post('/api/auth/login')
                .send({
                    email: user.email,
                    password: 'WrongPassword'
                })
                .expect(401);
        });

        it('should enforce rate limiting after 5 attempts', async () => {
            for (let i = 0; i < 6; i++) {
                const res = await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: 'attacker@test.com',
                        password: 'wrong'
                    });

                if (i === 5) {
                    assert.strictEqual(res.status, 429, 'Should rate limit');
                }
            }
        });
    });

    describe('Protected Routes', () => {
        let token;

        before(async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: user.email,
                    password: user.password
                });
            token = res.body.accessToken;
        });

        it('should access protected route with valid token', async () => {
            await request(app)
                .get('/api/dashboard/overview')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);
        });

        it('should reject without token', async () => {
            await request(app)
                .get('/api/dashboard/overview')
                .expect(401);
        });

        it('should reject with invalid token', async () => {
            await request(app)
                .get('/api/dashboard/overview')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);
        });
    });
});