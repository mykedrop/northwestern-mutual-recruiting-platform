-- Northwestern Mutual Trial Setup
-- Run this to prepare database for trial

-- Trial metrics table
CREATE TABLE IF NOT EXISTS trial_metrics (
    id SERIAL PRIMARY KEY,
    date DATE DEFAULT CURRENT_DATE,
    searches_count INTEGER DEFAULT 0,
    candidates_count INTEGER DEFAULT 0,
    messages_count INTEGER DEFAULT 0,
    interviews_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    hours_saved DECIMAL(10,2) DEFAULT 0,
    value_created DECIMAL(10,2) DEFAULT 0,
    UNIQUE(date)
);

-- Trial events tracking
CREATE TABLE IF NOT EXISTS trial_events (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL,
    event_data JSONB,
    user_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- NM-specific candidate scoring
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS nm_score INTEGER DEFAULT 50;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_career_changer BOOLEAN DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS competitor_employee BOOLEAN DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'MEDIUM';

-- NM outreach templates
CREATE TABLE IF NOT EXISTS nm_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    subject VARCHAR(500),
    body TEXT NOT NULL,
    target_type VARCHAR(50), -- 'career_changer', 'competitor', 'general'
    performance_score DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert NM-specific templates
INSERT INTO nm_templates (name, subject, body, target_type) VALUES
(
    'Teacher Career Change',
    'Your teaching skills are perfect for financial advisory',
    'Hi {firstName},

I noticed you''ve been teaching for {yearsExperience} years. Your skills in explanation, patience, and relationship-building are exactly what make our most successful financial advisors at Northwestern Mutual.

Many of our top performers transitioned from education. They love:
• Better work-life balance (no papers to grade!)
• Unlimited earning potential (avg first year: $85K)
• Using their teaching skills in a new way

Interested in a confidential conversation about making this transition?

Best,
{recruiterName}
Northwestern Mutual',
    'career_changer'
),
(
    'Competitor Outreach',
    'Better opportunity at Northwestern Mutual',
    'Hi {firstName},

I see you''re doing great work at {currentCompany}. Northwestern Mutual is selectively recruiting experienced advisors who want:

• Industry-leading technology and support
• No cold calling requirements
• Access to high-net-worth client base
• Better commission structure

Worth a confidential chat?

{recruiterName}
Northwestern Mutual',
    'competitor'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trial_events_date ON trial_events(created_at);
CREATE INDEX IF NOT EXISTS idx_candidates_nm_score ON candidates(nm_score DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_career_changer ON candidates(is_career_changer) WHERE is_career_changer = true;