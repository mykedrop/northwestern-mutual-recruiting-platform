-- Fix Enhanced Authentication Tables with correct UUID types
-- Drop and recreate tables with correct data types

-- Drop existing tables if they exist (they were created incorrectly)
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS password_history CASCADE;
DROP TABLE IF EXISTS security_events CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;

-- Session management table with UUID user_id
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    logged_out_at TIMESTAMP WITH TIME ZONE
);

-- Password history table with UUID user_id
CREATE TABLE password_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Security events table with UUID user_id
CREATE TABLE security_events (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES recruiters(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API keys table with UUID user_id
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    key_id VARCHAR(255) UNIQUE NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id UUID REFERENCES recruiters(id) ON DELETE CASCADE,
    permissions TEXT[],
    rate_limit INTEGER DEFAULT 1000,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for all tables
CREATE INDEX idx_user_sessions_session_id ON user_sessions (session_id);
CREATE INDEX idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at);
CREATE INDEX idx_user_sessions_is_active ON user_sessions (is_active);

CREATE INDEX idx_password_history_user_id ON password_history (user_id);
CREATE INDEX idx_password_history_created_at ON password_history (created_at);

CREATE INDEX idx_security_events_user_id ON security_events (user_id);
CREATE INDEX idx_security_events_event_type ON security_events (event_type);
CREATE INDEX idx_security_events_created_at ON security_events (created_at);
CREATE INDEX idx_security_events_success ON security_events (success);

CREATE INDEX idx_api_keys_key_id ON api_keys (key_id);
CREATE INDEX idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX idx_api_keys_is_active ON api_keys (is_active);
CREATE INDEX idx_api_keys_expires_at ON api_keys (expires_at);

-- Recreate functions with UUID support
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

-- Updated password history function with UUID support
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_password_history ON recruiters;
CREATE TRIGGER trigger_password_history
    AFTER UPDATE ON recruiters
    FOR EACH ROW
    EXECUTE FUNCTION check_password_history();

-- Insert initial password history for existing users
INSERT INTO password_history (user_id, password_hash)
SELECT id, password_hash
FROM recruiters
WHERE password_hash IS NOT NULL;

-- Add table comments
COMMENT ON TABLE user_sessions IS 'Tracks active user sessions for enhanced security';
COMMENT ON TABLE password_history IS 'Stores password history to prevent reuse';
COMMENT ON TABLE security_events IS 'Additional security event logging';
COMMENT ON TABLE api_keys IS 'API keys for service-to-service authentication';