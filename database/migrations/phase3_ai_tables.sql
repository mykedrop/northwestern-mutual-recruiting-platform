-- AI Predictions Table
CREATE TABLE ai_predictions (
    id SERIAL PRIMARY KEY,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    model_type VARCHAR(50) NOT NULL,
    model_version VARCHAR(20) NOT NULL,
    prediction_type VARCHAR(50) NOT NULL,
    prediction_value JSONB NOT NULL,
    confidence_score DECIMAL(3,2),
    features_used JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sourced Candidates Table
CREATE TABLE sourced_candidates (
    id SERIAL PRIMARY KEY,
    source_platform VARCHAR(50) NOT NULL,
    external_id VARCHAR(255),
    profile_url TEXT,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    location VARCHAR(255),
    current_title VARCHAR(255),
    current_company VARCHAR(255),
    years_experience INTEGER,
    skills TEXT[],
    education JSONB,
    profile_data JSONB,
    match_score DECIMAL(3,2),
    status VARCHAR(50) DEFAULT 'new',
    imported_to_candidate BOOLEAN DEFAULT FALSE,
    candidate_id UUID REFERENCES candidates(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Candidate Embeddings Table
CREATE TABLE candidate_embeddings (
    id SERIAL PRIMARY KEY,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    embedding_type VARCHAR(50) NOT NULL,
    embedding_vector FLOAT8[],
    metadata JSONB,
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(candidate_id, embedding_type)
);

-- ML Training Data Table
CREATE TABLE ml_training_data (
    id SERIAL PRIMARY KEY,
    candidate_id UUID REFERENCES candidates(id),
    features JSONB NOT NULL,
    labels JSONB NOT NULL,
    outcome_data JSONB,
    data_version VARCHAR(20),
    is_training BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email Campaigns Table
CREATE TABLE email_campaigns (
    id SERIAL PRIMARY KEY,
    campaign_name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    subject_line TEXT,
    email_template TEXT,
    personalization_fields JSONB,
    recipient_filters JSONB,
    scheduled_at TIMESTAMP,
    sent_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES recruiters(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email Campaign Recipients Table
CREATE TABLE email_campaign_recipients (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES email_campaigns(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id),
    email_address VARCHAR(255) NOT NULL,
    personalized_content TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    replied_at TIMESTAMP,
    bounce_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chatbot Conversations Table
CREATE TABLE chatbot_conversations (
    id SERIAL PRIMARY KEY,
    candidate_id UUID REFERENCES candidates(id),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    messages JSONB DEFAULT '[]'::jsonb,
    context JSONB DEFAULT '{}'::jsonb,
    sentiment_scores JSONB,
    escalated BOOLEAN DEFAULT FALSE,
    escalation_reason TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Interview Schedules Table
CREATE TABLE interview_schedules (
    id SERIAL PRIMARY KEY,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    interview_type VARCHAR(50) NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    timezone VARCHAR(50) DEFAULT 'America/Chicago',
    interviewers JSONB,
    location_type VARCHAR(50) DEFAULT 'video',
    location_details JSONB,
    calendar_event_id VARCHAR(255),
    meeting_link TEXT,
    status VARCHAR(50) DEFAULT 'scheduled',
    reminder_sent BOOLEAN DEFAULT FALSE,
    prep_materials_sent BOOLEAN DEFAULT FALSE,
    ai_brief_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Interview Intelligence Briefs Table
CREATE TABLE interview_briefs (
    id SERIAL PRIMARY KEY,
    interview_id INTEGER REFERENCES interview_schedules(id) ON DELETE CASCADE,
    candidate_summary TEXT,
    key_strengths JSONB,
    areas_to_probe JSONB,
    suggested_questions JSONB,
    similar_hires JSONB,
    cultural_indicators JSONB,
    red_flags JSONB,
    prediction_scores JSONB,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accessed_by JSONB DEFAULT '[]'::jsonb
);

-- Create indexes for performance
CREATE INDEX idx_ai_predictions_candidate ON ai_predictions(candidate_id);
CREATE INDEX idx_ai_predictions_type ON ai_predictions(prediction_type);
CREATE INDEX idx_sourced_candidates_status ON sourced_candidates(status);
CREATE INDEX idx_sourced_candidates_match ON sourced_candidates(match_score DESC);
CREATE INDEX idx_embeddings_candidate ON candidate_embeddings(candidate_id);
CREATE INDEX idx_email_recipients_campaign ON email_campaign_recipients(campaign_id);
CREATE INDEX idx_chatbot_session ON chatbot_conversations(session_id);
CREATE INDEX idx_interviews_date ON interview_schedules(scheduled_date);
CREATE INDEX idx_interviews_candidate ON interview_schedules(candidate_id);
