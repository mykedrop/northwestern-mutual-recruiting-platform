const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const db = require('./database');

// Passport configuration for OAuth
const configureOAuth = () => {
    // Serialize user for session
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user from session
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await db.query('SELECT * FROM recruiters WHERE id = $1', [id]);
            done(null, user.rows[0]);
        } catch (error) {
            done(error, null);
        }
    });

    // Google OAuth Strategy
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.API_BASE_URL}/api/auth/google/callback`
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            // Check if user exists
            const existingUser = await db.query(
                'SELECT * FROM recruiters WHERE google_id = $1 OR email = $2',
                [profile.id, profile.emails[0].value]
            );

            if (existingUser.rows.length > 0) {
                // User exists, update Google ID if not set
                const user = existingUser.rows[0];
                if (!user.google_id) {
                    await db.query(
                        'UPDATE recruiters SET google_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                        [profile.id, user.id]
                    );
                }
                return done(null, { ...user, google_id: profile.id });
            } else {
                // Check if email domain is authorized for Northwestern Mutual
                const emailDomain = profile.emails[0].value.split('@')[1];
                const authorizedDomains = ['northwesternmutual.com', 'nm.com'];

                if (!authorizedDomains.includes(emailDomain)) {
                    return done(new Error('Unauthorized email domain. Please use your Northwestern Mutual email address.'));
                }

                // Create new user
                const { v4: uuidv4 } = require('uuid');
                const userId = uuidv4();

                const newUser = await db.query(
                    `INSERT INTO recruiters (
                        id, email, first_name, last_name, google_id,
                        is_active, role, organization_id, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, true, 'recruiter', $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING *`,
                    [
                        userId,
                        profile.emails[0].value,
                        profile.name.givenName,
                        profile.name.familyName,
                        profile.id,
                        process.env.NM_ORGANIZATION_ID || 'nm-default-org'
                    ]
                );

                return done(null, newUser.rows[0]);
            }
        } catch (error) {
            console.error('Google OAuth error:', error);
            return done(error);
        }
    }));

    // Microsoft/Azure AD Strategy
    passport.use(new MicrosoftStrategy({
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: `${process.env.API_BASE_URL}/api/auth/microsoft/callback`,
        scope: ['user.read']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            // Check if user exists
            const existingUser = await db.query(
                'SELECT * FROM recruiters WHERE microsoft_id = $1 OR email = $2',
                [profile.id, profile.emails[0].value]
            );

            if (existingUser.rows.length > 0) {
                // User exists, update Microsoft ID if not set
                const user = existingUser.rows[0];
                if (!user.microsoft_id) {
                    await db.query(
                        'UPDATE recruiters SET microsoft_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                        [profile.id, user.id]
                    );
                }
                return done(null, { ...user, microsoft_id: profile.id });
            } else {
                // Check if email domain is authorized for Northwestern Mutual
                const emailDomain = profile.emails[0].value.split('@')[1];
                const authorizedDomains = ['northwesternmutual.com', 'nm.com'];

                if (!authorizedDomains.includes(emailDomain)) {
                    return done(new Error('Unauthorized email domain. Please use your Northwestern Mutual email address.'));
                }

                // Create new user
                const { v4: uuidv4 } = require('uuid');
                const userId = uuidv4();

                const newUser = await db.query(
                    `INSERT INTO recruiters (
                        id, email, first_name, last_name, microsoft_id,
                        is_active, role, organization_id, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, true, 'recruiter', $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING *`,
                    [
                        userId,
                        profile.emails[0].value,
                        profile.name.givenName,
                        profile.name.familyName,
                        profile.id,
                        process.env.NM_ORGANIZATION_ID || 'nm-default-org'
                    ]
                );

                return done(null, newUser.rows[0]);
            }
        } catch (error) {
            console.error('Microsoft OAuth error:', error);
            return done(error);
        }
    }));
};

module.exports = { configureOAuth };