-- Migration: Add MFA support for Northwestern Mutual compliance
-- Required for financial services security standards

ALTER TABLE recruiters
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT,
ADD COLUMN IF NOT EXISTS mfa_setup_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_mfa_verification TIMESTAMP;

-- Create index for MFA queries
CREATE INDEX IF NOT EXISTS idx_recruiters_mfa_enabled ON recruiters(mfa_enabled);

-- Update existing users to require MFA setup (Northwestern Mutual requirement)
UPDATE recruiters SET mfa_enabled = FALSE WHERE mfa_enabled IS NULL;

-- Add audit trail for MFA events
CREATE TABLE IF NOT EXISTS mfa_audit_log (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES recruiters(id),
    event_type VARCHAR(50) NOT NULL, -- 'setup', 'verify', 'disable', 'backup_used'
    success BOOLEAN NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for MFA audit queries
CREATE INDEX IF NOT EXISTS idx_mfa_audit_user_id ON mfa_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_audit_created_at ON mfa_audit_log(created_at);

COMMENT ON TABLE mfa_audit_log IS 'Audit trail for MFA events - Required for Northwestern Mutual compliance';
COMMENT ON COLUMN recruiters.mfa_enabled IS 'Whether MFA is enabled for this user - Required by Northwestern Mutual';
COMMENT ON COLUMN recruiters.mfa_secret IS 'Encrypted TOTP secret for MFA verification';
COMMENT ON COLUMN recruiters.mfa_backup_codes IS 'JSON array of backup codes for account recovery';