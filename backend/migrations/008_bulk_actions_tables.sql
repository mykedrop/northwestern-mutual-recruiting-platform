-- Phase 5 Tier 3: Bulk Actions Tables

-- Bulk Action Jobs Table
CREATE TABLE IF NOT EXISTS bulk_action_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  total_count INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  parameters JSONB DEFAULT '{}',
  results JSONB DEFAULT '{}',
  error_log TEXT[] DEFAULT '{}',
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Bulk Action Items Table
CREATE TABLE IF NOT EXISTS bulk_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES bulk_action_jobs(id) ON DELETE CASCADE,
  candidate_id INTEGER REFERENCES sourced_candidates(id),
  action_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  personalized_content TEXT,
  result JSONB,
  error_message TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Personalization Templates
CREATE TABLE IF NOT EXISTS personalization_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  template_type VARCHAR(50),
  base_template TEXT NOT NULL,
  personalization_rules JSONB DEFAULT '{}',
  variables TEXT[],
  success_rate DECIMAL(5,2),
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bulk Campaign Schedules
CREATE TABLE IF NOT EXISTS bulk_campaign_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name VARCHAR(255) NOT NULL,
  job_id UUID REFERENCES bulk_action_jobs(id),
  schedule_type VARCHAR(50),
  scheduled_time TIMESTAMP,
  recurrence_pattern JSONB,
  is_active BOOLEAN DEFAULT true,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default personalization templates (idempotent)
INSERT INTO personalization_templates (name, template_type, base_template, variables)
VALUES
(
  'Technical Talent Outreach',
  'email',
  'Hi {{firstName}},\n\nI noticed your experience with {{skills}} at {{company}}. We''re building something exciting at Northwestern Mutual that could leverage your expertise in {{primarySkill}}.\n\n{{personalizedHook}}\n\nWould you be open to a brief conversation about how your background in {{experience}} could contribute to our team?\n\nBest regards,\n{{recruiterName}}',
  ARRAY['firstName', 'skills', 'company', 'primarySkill', 'personalizedHook', 'experience', 'recruiterName']
),
(
  'LinkedIn Connection Request',
  'linkedin',
  'Hi {{firstName}}, I''m impressed by your work at {{company}}. {{personalizedReason}} Would love to connect and share an exciting opportunity that aligns with your experience in {{field}}.',
  ARRAY['firstName', 'company', 'personalizedReason', 'field']
),
(
  'Follow-up Sequence',
  'email',
  'Hi {{firstName}},\n\nFollowing up on my previous message about the {{role}} opportunity. {{personalizedUpdate}}\n\n{{callToAction}}\n\nBest,\n{{recruiterName}}',
  ARRAY['firstName', 'role', 'personalizedUpdate', 'callToAction', 'recruiterName']
)
ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_status ON bulk_action_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_created ON bulk_action_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_bulk_items_job ON bulk_action_items(job_id);
CREATE INDEX IF NOT EXISTS idx_bulk_items_candidate ON bulk_action_items(candidate_id);
CREATE INDEX IF NOT EXISTS idx_bulk_items_status ON bulk_action_items(status);

-- Progress view
DROP VIEW IF EXISTS bulk_action_progress CASCADE;
CREATE OR REPLACE VIEW bulk_action_progress AS
SELECT 
  j.id,
  j.action_type,
  j.status,
  j.total_count,
  j.processed_count,
  j.success_count,
  j.failed_count,
  CASE 
    WHEN j.total_count > 0 
    THEN ROUND((j.processed_count::DECIMAL / j.total_count) * 100, 2)
    ELSE 0
  END as progress_percentage,
  j.created_at,
  j.started_at,
  j.completed_at,
  EXTRACT(EPOCH FROM (COALESCE(j.completed_at, NOW()) - j.started_at)) as duration_seconds
FROM bulk_action_jobs j
ORDER BY j.created_at DESC;


