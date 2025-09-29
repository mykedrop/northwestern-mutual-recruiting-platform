-- Audit logs table for SOX compliance
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES recruiters(id),
    organization_id UUID REFERENCES organizations(id),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id VARCHAR(255),
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    result VARCHAR(50) DEFAULT 'success',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Security alerts table
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    details JSONB NOT NULL,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES recruiters(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_timestamp ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_result ON audit_logs(result);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip ON audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_resolved ON security_alerts(resolved);

-- Performance indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_org_recruiter
ON candidates(organization_id, recruiter_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_org_priority
ON candidates(organization_id, priority);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessments_candidate_status
ON assessments(candidate_id, status);

-- Text search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_email_search
ON candidates USING gin(to_tsvector('english', email));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_name_search
ON candidates USING gin(to_tsvector('english', first_name || ' ' || last_name));

-- Partial indexes for common filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_recruiters
ON recruiters(organization_id) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incomplete_assessments
ON assessments(candidate_id) WHERE status != 'completed';

-- Update table statistics
ANALYZE candidates;
ANALYZE assessments;
ANALYZE recruiters;
ANALYZE audit_logs;