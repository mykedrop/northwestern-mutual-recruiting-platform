-- Create database
CREATE DATABASE IF NOT EXISTS northwestern_mutual_recruiting;
\c northwestern_mutual_recruiting;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Recruiters table
CREATE TABLE recruiters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'recruiter',
    organization_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Candidates table
CREATE TABLE candidates (
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
CREATE TABLE assessments (
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
CREATE TABLE responses (
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
CREATE TABLE dimension_scores (
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
CREATE TABLE framework_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    framework VARCHAR(50) NOT NULL,
    result VARCHAR(100) NOT NULL,
    confidence DECIMAL(3,2),
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assessment_id, framework)
);

-- Notifications table
CREATE TABLE notifications (
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
CREATE TABLE export_logs (
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
CREATE INDEX idx_assessments_candidate ON assessments(candidate_id);
CREATE INDEX idx_assessments_status ON assessments(status);
CREATE INDEX idx_responses_assessment ON responses(assessment_id);
CREATE INDEX idx_dimension_scores_assessment ON dimension_scores(assessment_id);
CREATE INDEX idx_notifications_recruiter ON notifications(recruiter_id, read);
CREATE INDEX idx_candidates_recruiter ON candidates(recruiter_id);

-- Candidate pipeline stages
CREATE TABLE pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    order_position INTEGER NOT NULL,
    color VARCHAR(7) DEFAULT '#003d82',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Candidate pipeline status
CREATE TABLE candidate_pipeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES pipeline_stages(id),
    moved_by UUID REFERENCES recruiters(id),
    notes TEXT,
    moved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(candidate_id)
);

-- Intelligence reports
CREATE TABLE intelligence_reports (
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

-- Behavioral insights templates
CREATE TABLE insight_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dimension VARCHAR(100) NOT NULL,
    score_range VARCHAR(20) NOT NULL,
    insight_text TEXT NOT NULL,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
('Declined/Rejected', 9, '#e74c3c', 'Process ended');

-- Create additional indexes for new tables
CREATE INDEX idx_pipeline_candidate ON candidate_pipeline(candidate_id);
CREATE INDEX idx_pipeline_stage ON candidate_pipeline(stage_id);
CREATE INDEX idx_reports_assessment ON intelligence_reports(assessment_id);
