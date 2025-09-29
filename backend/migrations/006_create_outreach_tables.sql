-- Outreach Templates
CREATE TABLE IF NOT EXISTS outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  channel VARCHAR(50) NOT NULL, -- email, sms, linkedin
  subject VARCHAR(255),
  body_template TEXT NOT NULL,
  variables TEXT[], -- ['first_name', 'company', 'title']
  category VARCHAR(100),
  performance_metrics JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Ensure template names are unique for ON CONFLICT support
CREATE UNIQUE INDEX IF NOT EXISTS ux_outreach_templates_name ON outreach_templates(name);

-- Outreach Campaigns
CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  template_id UUID REFERENCES outreach_templates(id),
  target_criteria JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'draft', -- draft, active, paused, completed
  scheduled_at TIMESTAMP,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Outreach Messages
CREATE TABLE IF NOT EXISTS outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES outreach_campaigns(id),
  candidate_id INTEGER REFERENCES sourced_candidates(id),
  channel VARCHAR(50) NOT NULL,
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(50),
  subject VARCHAR(255),
  body TEXT,
  personalization_data JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, opened, clicked, replied, failed
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  replied_at TIMESTAMP,
  reply_text TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Job Seeking Signals
CREATE TABLE IF NOT EXISTS job_seeking_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id INTEGER REFERENCES sourced_candidates(id),
  signal_type VARCHAR(100), -- open_to_work, profile_update, job_view, etc
  signal_strength DECIMAL(3,2), -- 0.0 to 1.0
  signal_data JSONB DEFAULT '{}',
  detected_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Ensure single active row per candidate/signal_type for upserts
CREATE UNIQUE INDEX IF NOT EXISTS ux_job_seeking_signals_candidate_type ON job_seeking_signals(candidate_id, signal_type);

-- Bulk Actions Log
CREATE TABLE IF NOT EXISTS bulk_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(100), -- email_campaign, pipeline_import, tagging, etc
  candidate_ids INTEGER[],
  total_count INTEGER,
  successful_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  parameters JSONB DEFAULT '{}',
  error_log JSONB DEFAULT '[]',
  initiated_by VARCHAR(255),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_outreach_messages_campaign ON outreach_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_candidate ON outreach_messages(candidate_id);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_status ON outreach_messages(status);
CREATE INDEX IF NOT EXISTS idx_job_seeking_signals_candidate ON job_seeking_signals(candidate_id);
CREATE INDEX IF NOT EXISTS idx_job_seeking_signals_type ON job_seeking_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_bulk_actions_status ON bulk_actions(status);





