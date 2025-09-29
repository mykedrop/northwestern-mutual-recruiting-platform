-- Northwestern Mutual Recruiting Platform Schema
-- Advanced candidate assessment with cheat detection

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    linkedin_url VARCHAR(500),
    resume_url VARCHAR(500),
    source VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(10),
    willing_to_relocate BOOLEAN DEFAULT FALSE,
    years_experience INTEGER,
    previous_companies JSONB,
    education JSONB,
    certifications JSONB,
    assessment_status VARCHAR(50) DEFAULT 'not_started',
    assessment_score INTEGER,
    assessment_tier VARCHAR(20),
    authenticity_score DECIMAL(5,2),
    cheat_probability DECIMAL(5,2),
    behavioral_flags JSONB,
    cultural_fit_score DECIMAL(5,2),
    sales_potential DECIMAL(5,2),
    retention_probability DECIMAL(5,2),
    client_relationship_score DECIMAL(5,2),
    recruiter_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP
);

-- Assessments table
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    start_time TIMESTAMP DEFAULT NOW(),
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    completion_status VARCHAR(50) DEFAULT 'in_progress',
    responses JSONB NOT NULL DEFAULT '[]',
    question_count INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    final_score INTEGER,
    score_breakdown JSONB,
    tier_classification VARCHAR(20),
    cultural_fit DECIMAL(5,2),
    leadership_potential DECIMAL(5,2),
    sales_aptitude DECIMAL(5,2),
    client_focus DECIMAL(5,2),
    integrity_score DECIMAL(5,2),
    behavioral_data JSONB NOT NULL DEFAULT '{}',
    authenticity_flags JSONB DEFAULT '[]'
);

-- Cheat detection logs
CREATE TABLE IF NOT EXISTS cheat_detection_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_timestamp TIMESTAMP DEFAULT NOW(),
    severity VARCHAR(20) DEFAULT 'low',
    confidence_score DECIMAL(5,2),
    event_data JSONB NOT NULL DEFAULT '{}',
    context_data JSONB DEFAULT '{}',
    is_suspicious BOOLEAN DEFAULT FALSE,
    auto_flagged BOOLEAN DEFAULT FALSE,
    human_reviewed BOOLEAN DEFAULT FALSE,
    reviewer_notes TEXT
);

-- Behavioral tracking
CREATE TABLE IF NOT EXISTS behavioral_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    question_id VARCHAR(100),
    mouse_movements JSONB DEFAULT '[]',
    mouse_clicks JSONB DEFAULT '[]',
    mouse_hovers JSONB DEFAULT '[]',
    hesitation_points JSONB DEFAULT '[]',
    typing_patterns JSONB DEFAULT '{}',
    keystroke_timings JSONB DEFAULT '[]',
    deletion_patterns JSONB DEFAULT '[]',
    focus_events JSONB DEFAULT '[]',
    scroll_patterns JSONB DEFAULT '[]',
    window_interactions JSONB DEFAULT '[]',
    question_start_time TIMESTAMP,
    question_end_time TIMESTAMP,
    thinking_time INTEGER,
    total_interaction_time INTEGER,
    confidence_indicators JSONB DEFAULT '{}',
    stress_indicators JSONB DEFAULT '{}',
    authenticity_markers JSONB DEFAULT '{}'
);

-- Recruiter alerts
CREATE TABLE IF NOT EXISTS recruiter_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    alert_data JSONB DEFAULT '{}',
    action_required BOOLEAN DEFAULT FALSE,
    action_taken BOOLEAN DEFAULT FALSE,
    recruiter_id UUID,
    team_id UUID,
    broadcast_to_all BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP,
    acknowledged_at TIMESTAMP
);

-- Analytics events
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    candidate_id UUID,
    assessment_id UUID,
    recruiter_id UUID,
    event_data JSONB NOT NULL DEFAULT '{}',
    metrics JSONB DEFAULT '{}',
    processing_time_ms INTEGER,
    api_endpoint VARCHAR(200),
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW()
);

