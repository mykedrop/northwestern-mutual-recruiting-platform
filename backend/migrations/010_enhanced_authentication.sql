-- Enhanced Authentication Migration
-- This migration adds enterprise-grade security features to the authentication system

-- Add enhanced security fields to recruiters table
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS department VARCHAR(100) DEFAULT 'recruiting';
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'recruiter';
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS last_failed_attempt TIMESTAMP WITH TIME ZONE;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'active';
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS created_by_ip INET;

-- MFA fields
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255);
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT[];

-- Session management table
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    logged_out_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions (is_active);

CREATE INDEX IF NOT EXISTS idx_recruiters_email ON recruiters (email);
CREATE INDEX IF NOT EXISTS idx_recruiters_account_status ON recruiters (account_status);
CREATE INDEX IF NOT EXISTS idx_recruiters_locked_until ON recruiters (locked_until);

-- Password history table for preventing password reuse
CREATE TABLE IF NOT EXISTS password_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history (user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history (created_at);

-- Security events table for additional security monitoring
CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES recruiters(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events (user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events (event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events (created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_success ON security_events (success);

-- API keys table for service-to-service authentication
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    key_id VARCHAR(255) UNIQUE NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id INTEGER REFERENCES recruiters(id) ON DELETE CASCADE,
    permissions TEXT[],
    rate_limit INTEGER DEFAULT 1000,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys (key_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys (is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys (expires_at);

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions
    WHERE expires_at < CURRENT_TIMESTAMP
    OR (is_active = FALSE AND logged_out_at < CURRENT_TIMESTAMP - INTERVAL '7 days');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to enforce password history (prevent reuse of last 12 passwords)
CREATE OR REPLACE FUNCTION check_password_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Only check if password is being changed
    IF TG_OP = 'UPDATE' AND OLD.password_hash != NEW.password_hash THEN
        -- Check against last 12 passwords
        IF EXISTS (
            SELECT 1 FROM password_history
            WHERE user_id = NEW.id
            AND password_hash = NEW.password_hash
            ORDER BY created_at DESC
            LIMIT 12
        ) THEN
            RAISE EXCEPTION 'Password has been used recently and cannot be reused';
        END IF;

        -- Store new password in history
        INSERT INTO password_history (user_id, password_hash)
        VALUES (NEW.id, NEW.password_hash);

        -- Keep only last 12 passwords
        DELETE FROM password_history
        WHERE user_id = NEW.id
        AND id NOT IN (
            SELECT id FROM password_history
            WHERE user_id = NEW.id
            ORDER BY created_at DESC
            LIMIT 12
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for password history
DROP TRIGGER IF EXISTS trigger_password_history ON recruiters;
CREATE TRIGGER trigger_password_history
    AFTER UPDATE ON recruiters
    FOR EACH ROW
    EXECUTE FUNCTION check_password_history();

-- Function to auto-unlock accounts after lockout period
CREATE OR REPLACE FUNCTION auto_unlock_accounts()
RETURNS INTEGER AS $$
DECLARE
    unlocked_count INTEGER;
BEGIN
    UPDATE recruiters
    SET failed_attempts = 0,
        locked_until = NULL
    WHERE locked_until IS NOT NULL
    AND locked_until < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS unlocked_count = ROW_COUNT;
    RETURN unlocked_count;
END;
$$ LANGUAGE plpgsql;

-- Create demo user with enhanced security if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM recruiters WHERE email = 'demo@northwestern.com') THEN
        INSERT INTO recruiters (
            email, password_hash, first_name, last_name, department, role,
            account_status, email_verified, password_changed_at
        ) VALUES (
            'demo@northwestern.com',
            '$2a$14$8K1p/a3S7c6F4L9k2N6TXe.1oQN5Wf8V9Y7Z3B2M4K6L8P0R2T4V6', -- password123
            'Demo',
            'User',
            'recruiting',
            'admin',
            'active',
            TRUE,
            CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- Insert initial password history for demo user
INSERT INTO password_history (user_id, password_hash)
SELECT id, password_hash
FROM recruiters
WHERE email = 'demo@northwestern.com'
AND NOT EXISTS (
    SELECT 1 FROM password_history
    WHERE user_id = (SELECT id FROM recruiters WHERE email = 'demo@northwestern.com')
);

COMMENT ON TABLE user_sessions IS 'Tracks active user sessions for enhanced security';
COMMENT ON TABLE password_history IS 'Stores password history to prevent reuse';
COMMENT ON TABLE security_events IS 'Additional security event logging';
COMMENT ON TABLE api_keys IS 'API keys for service-to-service authentication';