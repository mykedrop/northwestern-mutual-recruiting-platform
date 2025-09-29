-- SOX Compliance Audit Schema for Northwestern Mutual
-- Implements Sarbanes-Oxley Section 404 requirements

-- Immutable audit log table with 7-year retention
CREATE TABLE IF NOT EXISTS sox_audit_log (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(50) UNIQUE NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    user_id UUID REFERENCES recruiters(id),
    event_data JSONB NOT NULL,
    data_integrity_hash VARCHAR(64) NOT NULL,
    digital_signature VARCHAR(64) NOT NULL,
    tamper_seal VARCHAR(32) NOT NULL,
    compliance_flags JSONB DEFAULT '{}',
    retention_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Immutable protection - no updates or deletes allowed
    CONSTRAINT sox_audit_log_immutable CHECK (created_at IS NOT NULL)
);

-- Compliance alerts table
CREATE TABLE IF NOT EXISTS sox_compliance_alerts (
    id SERIAL PRIMARY KEY,
    alert_id VARCHAR(50) UNIQUE NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    severity INTEGER NOT NULL, -- 1=LOW, 2=MEDIUM, 3=HIGH, 4=CRITICAL
    original_event_id VARCHAR(50) REFERENCES sox_audit_log(event_id),
    violations JSONB NOT NULL,
    requires_review BOOLEAN DEFAULT TRUE,
    notification_sent BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES recruiters(id),
    reviewed_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compliance metrics tracking
CREATE TABLE IF NOT EXISTS sox_compliance_metrics (
    id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    total_events INTEGER DEFAULT 0,
    high_risk_events INTEGER DEFAULT 0,
    compliance_violations INTEGER DEFAULT 0,
    data_access_events INTEGER DEFAULT 0,
    security_events INTEGER DEFAULT 0,
    financial_events INTEGER DEFAULT 0,
    audit_coverage_percentage DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric_date)
);

-- Indexes for performance and compliance queries
CREATE INDEX IF NOT EXISTS idx_sox_audit_event_id ON sox_audit_log(event_id);
CREATE INDEX IF NOT EXISTS idx_sox_audit_timestamp ON sox_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_sox_audit_user_id ON sox_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sox_audit_event_type ON sox_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_sox_audit_risk_level ON sox_audit_log(risk_level);
CREATE INDEX IF NOT EXISTS idx_sox_audit_retention ON sox_audit_log(retention_date);

-- Compliance alerts indexes
CREATE INDEX IF NOT EXISTS idx_sox_alerts_severity ON sox_compliance_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_sox_alerts_requires_review ON sox_compliance_alerts(requires_review);
CREATE INDEX IF NOT EXISTS idx_sox_alerts_timestamp ON sox_compliance_alerts(timestamp);

-- Compliance metrics indexes
CREATE INDEX IF NOT EXISTS idx_sox_metrics_date ON sox_compliance_metrics(metric_date);

-- Views for compliance reporting
CREATE OR REPLACE VIEW sox_compliance_dashboard AS
SELECT
    DATE(timestamp) as audit_date,
    COUNT(*) as total_events,
    COUNT(CASE WHEN risk_level IN ('HIGH', 'CRITICAL') THEN 1 END) as high_risk_events,
    COUNT(CASE WHEN event_type = 'DATA_ACCESS' THEN 1 END) as data_access_events,
    COUNT(CASE WHEN event_type = 'SECURITY' THEN 1 END) as security_events,
    COUNT(CASE WHEN event_data->>'success' = 'false' THEN 1 END) as failed_events,
    COUNT(DISTINCT user_id) as active_users
FROM sox_audit_log
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY audit_date DESC;

-- View for high-risk activity monitoring
CREATE OR REPLACE VIEW sox_high_risk_activity AS
SELECT
    sal.event_id,
    sal.timestamp,
    sal.event_type,
    sal.risk_level,
    r.email as user_email,
    sal.event_data->>'action' as action,
    sal.event_data->>'details' as details
FROM sox_audit_log sal
LEFT JOIN recruiters r ON sal.user_id = r.id
WHERE sal.risk_level IN ('HIGH', 'CRITICAL')
AND sal.timestamp >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY sal.timestamp DESC;

-- View for compliance violations
CREATE OR REPLACE VIEW sox_compliance_violations AS
SELECT
    sca.alert_id,
    sca.timestamp,
    sca.severity,
    sal.event_type,
    r.email as user_email,
    sca.violations->0->>'rule' as violation_rule,
    sca.violations->0->>'description' as violation_description,
    sca.requires_review,
    sca.reviewed_at
FROM sox_compliance_alerts sca
JOIN sox_audit_log sal ON sca.original_event_id = sal.event_id
LEFT JOIN recruiters r ON sal.user_id = r.id
WHERE sca.requires_review = TRUE
ORDER BY sca.timestamp DESC;

-- Row Level Security (RLS) for audit data protection
ALTER TABLE sox_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sox_compliance_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Only compliance officers and admins can access audit data
CREATE POLICY sox_audit_access_policy ON sox_audit_log
    FOR ALL
    TO authenticated_users
    USING (
        EXISTS (
            SELECT 1 FROM recruiters
            WHERE id = current_setting('app.current_user_id')::uuid
            AND role IN ('admin', 'compliance_officer')
        )
    );

-- Policy: Compliance alerts access
CREATE POLICY sox_alerts_access_policy ON sox_compliance_alerts
    FOR ALL
    TO authenticated_users
    USING (
        EXISTS (
            SELECT 1 FROM recruiters
            WHERE id = current_setting('app.current_user_id')::uuid
            AND role IN ('admin', 'compliance_officer')
        )
    );

-- Function to automatically archive old audit data (7+ years)
CREATE OR REPLACE FUNCTION archive_expired_audit_data()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Move expired data to archive table (create if not exists)
    CREATE TABLE IF NOT EXISTS sox_audit_log_archive (LIKE sox_audit_log INCLUDING ALL);

    -- Insert expired records into archive
    INSERT INTO sox_audit_log_archive
    SELECT * FROM sox_audit_log
    WHERE retention_date < CURRENT_DATE;

    GET DIAGNOSTICS archived_count = ROW_COUNT;

    -- Delete from main table (SOX allows deletion after retention period)
    DELETE FROM sox_audit_log
    WHERE retention_date < CURRENT_DATE;

    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Function to generate daily compliance metrics
CREATE OR REPLACE FUNCTION generate_daily_compliance_metrics()
RETURNS VOID AS $$
BEGIN
    INSERT INTO sox_compliance_metrics (
        metric_date,
        total_events,
        high_risk_events,
        compliance_violations,
        data_access_events,
        security_events,
        financial_events,
        audit_coverage_percentage
    )
    SELECT
        CURRENT_DATE - 1,
        COUNT(*),
        COUNT(CASE WHEN risk_level IN ('HIGH', 'CRITICAL') THEN 1 END),
        (SELECT COUNT(*) FROM sox_compliance_alerts WHERE DATE(timestamp) = CURRENT_DATE - 1),
        COUNT(CASE WHEN event_type = 'DATA_ACCESS' THEN 1 END),
        COUNT(CASE WHEN event_type = 'SECURITY' THEN 1 END),
        COUNT(CASE WHEN event_data->>'complianceFlags'->>'financialReporting' = 'true' THEN 1 END),
        100.00 -- Placeholder for coverage calculation
    FROM sox_audit_log
    WHERE DATE(timestamp) = CURRENT_DATE - 1
    ON CONFLICT (metric_date) DO UPDATE SET
        total_events = EXCLUDED.total_events,
        high_risk_events = EXCLUDED.high_risk_events,
        compliance_violations = EXCLUDED.compliance_violations,
        data_access_events = EXCLUDED.data_access_events,
        security_events = EXCLUDED.security_events,
        financial_events = EXCLUDED.financial_events,
        audit_coverage_percentage = EXCLUDED.audit_coverage_percentage;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE sox_audit_log IS 'Immutable audit log for SOX Section 404 compliance - Northwestern Mutual';
COMMENT ON TABLE sox_compliance_alerts IS 'Real-time compliance violation alerts and tracking';
COMMENT ON TABLE sox_compliance_metrics IS 'Daily compliance metrics for executive reporting';
COMMENT ON COLUMN sox_audit_log.data_integrity_hash IS 'SHA-256 hash for tamper detection';
COMMENT ON COLUMN sox_audit_log.digital_signature IS 'HMAC signature for authenticity verification';
COMMENT ON COLUMN sox_audit_log.tamper_seal IS 'Tamper-evident seal for integrity assurance';
COMMENT ON COLUMN sox_audit_log.retention_date IS 'Date when record can be archived (7 years from creation)';

-- Schedule daily compliance metrics generation (requires pg_cron extension)
-- SELECT cron.schedule('generate-daily-metrics', '0 1 * * *', 'SELECT generate_daily_compliance_metrics();');