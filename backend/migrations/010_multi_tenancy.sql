-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    features JSONB DEFAULT '{"max_recruiters": 50, "max_candidates": 10000}',
    subscription_tier VARCHAR(50) DEFAULT 'enterprise',
    subscription_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Teams within organizations
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    region VARCHAR(100),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- Update recruiters table for multi-tenancy
ALTER TABLE recruiters
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id),
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id),
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'recruiter',
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255);

-- Add organization scoping to all tables
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id),
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

ALTER TABLE assessments
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recruiters_org ON recruiters(organization_id);
CREATE INDEX IF NOT EXISTS idx_recruiters_team ON recruiters(team_id);
CREATE INDEX IF NOT EXISTS idx_candidates_org ON candidates(organization_id);
CREATE INDEX IF NOT EXISTS idx_candidates_team ON candidates(team_id);
CREATE INDEX IF NOT EXISTS idx_candidates_recruiter ON candidates(recruiter_id);

-- Row Level Security Policies
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for candidates
CREATE POLICY candidates_isolation ON candidates
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM recruiters WHERE id = current_setting('app.current_user_id')::UUID
        )
        AND (
            recruiter_id = current_setting('app.current_user_id')::UUID
            OR
            team_id IN (
                SELECT team_id FROM recruiters WHERE id = current_setting('app.current_user_id')::UUID
            )
        )
    );

-- Seed Northwestern Mutual organization
INSERT INTO organizations (id, name, slug, subscription_tier)
VALUES ('f47b3b3d-7e3f-4c55-9c0a-8f1b4d3e2a1b', 'Northwestern Mutual', 'northwestern-mutual', 'enterprise')
ON CONFLICT DO NOTHING;

INSERT INTO teams (id, organization_id, name, region)
VALUES
    ('a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'f47b3b3d-7e3f-4c55-9c0a-8f1b4d3e2a1b', 'Philadelphia Region', 'Philadelphia'),
    ('b2c3d4e5-6f7a-8b9c-0d1e-2f3a4b5c6d7e', 'f47b3b3d-7e3f-4c55-9c0a-8f1b4d3e2a1b', 'New York Region', 'New York')
ON CONFLICT DO NOTHING;

-- Update existing data to have organization
UPDATE recruiters SET organization_id = 'f47b3b3d-7e3f-4c55-9c0a-8f1b4d3e2a1b' WHERE organization_id IS NULL;
UPDATE candidates SET organization_id = 'f47b3b3d-7e3f-4c55-9c0a-8f1b4d3e2a1b' WHERE organization_id IS NULL;