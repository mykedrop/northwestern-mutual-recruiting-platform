-- Migration 001: Core Schema
-- Description: Creates core Northwestern Mutual recruiting platform schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table (for multi-tenant support)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Northwestern Mutual organization
INSERT INTO organizations (name, domain)
VALUES ('Northwestern Mutual', 'northwestern.com')
ON CONFLICT DO NOTHING;

-- Recruiters table with OAuth support
CREATE TABLE IF NOT EXISTS recruiters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL for OAuth users
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'recruiter',
    organization_id UUID REFERENCES organizations(id),
    google_id VARCHAR(255), -- Google OAuth ID
    microsoft_id VARCHAR(255), -- Microsoft OAuth ID
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    linkedin_url VARCHAR(500),
    resume_url VARCHAR(500),
    source VARCHAR(100),
    recruiter_id UUID REFERENCES recruiters(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assessments table
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'not_started',
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    completion_percentage INTEGER DEFAULT 0,
    current_question INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 27,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Responses table
CREATE TABLE IF NOT EXISTS responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    question_id VARCHAR(50) NOT NULL,
    question_type VARCHAR(50) NOT NULL,
    response_data JSONB NOT NULL,
    time_spent_ms INTEGER,
    mouse_movements INTEGER,
    key_strokes INTEGER,
    tab_switches INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dimension scores table
CREATE TABLE IF NOT EXISTS dimension_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    dimension VARCHAR(100) NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    percentile INTEGER,
    benchmark_comparison VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assessment_id, dimension)
);

-- Framework mappings table
CREATE TABLE IF NOT EXISTS framework_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    framework VARCHAR(50) NOT NULL,
    result VARCHAR(100) NOT NULL,
    confidence DECIMAL(3,2),
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assessment_id, framework)
);

-- Pipeline stages
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    order_position INTEGER NOT NULL,
    color VARCHAR(7) DEFAULT '#003d82',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Candidate pipeline status
CREATE TABLE IF NOT EXISTS candidate_pipeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES pipeline_stages(id),
    moved_by UUID REFERENCES recruiters(id),
    notes TEXT,
    moved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(candidate_id)
);

-- Intelligence reports
CREATE TABLE IF NOT EXISTS intelligence_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    executive_summary TEXT,
    strengths JSONB,
    growth_areas JSONB,
    behavioral_predictions JSONB,
    communication_style JSONB,
    work_style JSONB,
    team_dynamics JSONB,
    risk_factors JSONB,
    recommendations JSONB,
    cultural_fit_score INTEGER,
    role_fit_scores JSONB,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assessment_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recruiter_id UUID REFERENCES recruiters(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Export logs table
CREATE TABLE IF NOT EXISTS export_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recruiter_id UUID REFERENCES recruiters(id),
    export_type VARCHAR(20) NOT NULL,
    filters JSONB,
    file_path VARCHAR(500),
    status VARCHAR(50) DEFAULT 'processing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recruiters_email ON recruiters(email);
CREATE INDEX IF NOT EXISTS idx_recruiters_google_id ON recruiters(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recruiters_microsoft_id ON recruiters(microsoft_id) WHERE microsoft_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recruiters_organization ON recruiters(organization_id);

CREATE INDEX IF NOT EXISTS idx_assessments_candidate ON assessments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
CREATE INDEX IF NOT EXISTS idx_responses_assessment ON responses(assessment_id);
CREATE INDEX IF NOT EXISTS idx_dimension_scores_assessment ON dimension_scores(assessment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recruiter ON notifications(recruiter_id, read);
CREATE INDEX IF NOT EXISTS idx_candidates_recruiter ON candidates(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_candidate ON candidate_pipeline(candidate_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage ON candidate_pipeline(stage_id);
CREATE INDEX IF NOT EXISTS idx_reports_assessment ON intelligence_reports(assessment_id);

-- Insert default pipeline stages
INSERT INTO pipeline_stages (name, order_position, color, description) VALUES
('Applied', 1, '#95a5a6', 'Candidate has submitted application'),
('Assessment Sent', 2, '#3498db', 'Assessment link sent to candidate'),
('Assessment Complete', 3, '#9b59b6', 'Candidate completed behavioral assessment'),
('Interview Scheduled', 4, '#f39c12', 'Interview has been scheduled'),
('Interview Complete', 5, '#e67e22', 'Interview has been conducted'),
('Reference Check', 6, '#16a085', 'Checking candidate references'),
('Offer Extended', 7, '#27ae60', 'Job offer has been made'),
('Hired', 8, '#27ae60', 'Candidate accepted offer'),
('Declined/Rejected', 9, '#e74c3c', 'Process ended')
ON CONFLICT DO NOTHING;