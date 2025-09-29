-- Career Change System Tables
-- Migration 009: Add career change identification infrastructure

-- 1. Profession Mapping Table (defines which professions to target)
CREATE TABLE IF NOT EXISTS profession_mappings (
    id SERIAL PRIMARY KEY,
    profession_category VARCHAR(100) NOT NULL UNIQUE,
    tier INTEGER CHECK (tier IN (1, 2, 3)),
    current_titles TEXT[], -- Array of job titles to search
    industries TEXT[], -- Industries where these professionals work
    required_years_experience INTEGER DEFAULT 2,
    key_skills TEXT[], -- Skills that transfer well
    transferable_competencies JSONB, -- Detailed competency mapping
    success_probability_range NUMRANGE DEFAULT '[0.3,0.7]'::NUMRANGE,
    avg_ramp_time_months INTEGER DEFAULT 6,
    search_keywords TEXT[], -- LinkedIn search terms
    exclusion_terms TEXT[], -- Terms to exclude from search
    messaging_hooks JSONB, -- Profession-specific messaging angles
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    active BOOLEAN DEFAULT true
);

-- 2. Industry Health Scores (tracks industry distress signals)
CREATE TABLE IF NOT EXISTS industry_health_scores (
    id SERIAL PRIMARY KEY,
    industry_name VARCHAR(200) NOT NULL,
    automation_risk_score DECIMAL(3,2) CHECK (automation_risk_score >= 0 AND automation_risk_score <= 1),
    recent_layoffs_count INTEGER DEFAULT 0,
    layoff_trend VARCHAR(20) CHECK (layoff_trend IN ('increasing', 'stable', 'decreasing')),
    market_growth_rate DECIMAL(5,2), -- Percentage
    regulatory_pressure_score DECIMAL(3,2) CHECK (regulatory_pressure_score >= 0 AND regulatory_pressure_score <= 1),
    overall_distress_score DECIMAL(3,2) CHECK (overall_distress_score >= 0 AND overall_distress_score <= 1),
    data_source VARCHAR(100), -- Where this data came from
    last_updated TIMESTAMP DEFAULT NOW(),
    notes TEXT
);

-- 3. Career Change Indicators (signals that someone is ready to change)
CREATE TABLE IF NOT EXISTS career_change_indicators (
    id SERIAL PRIMARY KEY,
    indicator_type VARCHAR(50) CHECK (indicator_type IN ('industry_distress', 'personal_trigger', 'skill_match', 'career_plateau')),
    indicator_name VARCHAR(200) NOT NULL,
    weight DECIMAL(3,2) DEFAULT 0.25,
    detection_pattern TEXT, -- How to detect this indicator
    linkedin_signals TEXT[], -- Specific LinkedIn profile signals
    required_data_points TEXT[], -- What data we need to evaluate
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Career Changer Scores (calculated scores per candidate)
CREATE TABLE IF NOT EXISTS career_changer_scores (
    id SERIAL PRIMARY KEY,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    sourced_candidate_id INTEGER REFERENCES sourced_candidates(id) ON DELETE CASCADE,
    current_profession VARCHAR(100),
    profession_tier INTEGER,
    years_in_profession INTEGER,
    profession_match_score DECIMAL(3,2),
    industry_distress_score DECIMAL(3,2),
    personal_readiness_score DECIMAL(3,2),
    skill_overlap_score DECIMAL(3,2),
    total_score DECIMAL(3,2),
    score_breakdown JSONB, -- Detailed scoring explanation
    recommended_messaging_angle VARCHAR(100),
    nurture_stage VARCHAR(50) DEFAULT 'not_started',
    last_calculated TIMESTAMP DEFAULT NOW(),
    UNIQUE(candidate_id),
    UNIQUE(sourced_candidate_id)
);

-- 5. Career Change Campaign Templates
CREATE TABLE IF NOT EXISTS career_change_templates (
    id SERIAL PRIMARY KEY,
    profession_category VARCHAR(100) REFERENCES profession_mappings(profession_category),
    tier INTEGER,
    template_type VARCHAR(50) CHECK (template_type IN ('initial_outreach', 'follow_up_1', 'follow_up_2', 'nurture_week_1', 'nurture_week_4', 'nurture_week_8', 'nurture_week_12')),
    subject_line TEXT,
    email_template TEXT,
    sms_template TEXT,
    linkedin_template TEXT,
    personalization_variables TEXT[], -- Variables to replace
    performance_metrics JSONB, -- Track open/response rates
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_profession_mappings_tier ON profession_mappings(tier);
CREATE INDEX idx_profession_mappings_category ON profession_mappings(profession_category);
CREATE INDEX idx_career_changer_scores_total ON career_changer_scores(total_score DESC);
CREATE INDEX idx_career_changer_scores_tier ON career_changer_scores(profession_tier);
CREATE INDEX idx_career_changer_scores_candidate ON career_changer_scores(candidate_id);
CREATE INDEX idx_career_changer_scores_sourced ON career_changer_scores(sourced_candidate_id);
CREATE INDEX idx_industry_health_distress ON industry_health_scores(overall_distress_score DESC);
CREATE INDEX idx_career_change_templates_prof ON career_change_templates(profession_category, template_type);

-- Add career change fields to sourced_candidates if they don't exist
ALTER TABLE sourced_candidates 
ADD COLUMN IF NOT EXISTS is_career_changer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS career_change_score DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS previous_profession VARCHAR(100),
ADD COLUMN IF NOT EXISTS years_in_profession INTEGER;

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profession_mappings_updated_at BEFORE UPDATE ON profession_mappings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_career_change_templates_updated_at BEFORE UPDATE ON career_change_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
