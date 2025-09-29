-- Job Board Integrations Migration
-- Adds support for Indeed and ZipRecruiter API integrations

-- Job Postings table for tracking posted jobs across multiple boards
CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  requirements TEXT,
  location JSONB,
  job_type VARCHAR(50) DEFAULT 'full-time',
  salary_min INTEGER,
  salary_max INTEGER,
  currency VARCHAR(10) DEFAULT 'USD',
  company_name VARCHAR(255),
  contact_email VARCHAR(255),
  apply_instructions TEXT,
  sources TEXT[] DEFAULT ARRAY[]::TEXT[],
  external_ids JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active',
  posted_by UUID REFERENCES users(id),
  posted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  view_count INTEGER DEFAULT 0,
  application_count INTEGER DEFAULT 0,
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Job Board API Configurations
CREATE TABLE IF NOT EXISTS job_board_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  source VARCHAR(50) NOT NULL,
  api_key TEXT,
  client_id TEXT,
  client_secret TEXT,
  additional_config JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active',
  last_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, source)
);

-- Job Applications from external sources
CREATE TABLE IF NOT EXISTS external_job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id UUID REFERENCES job_postings(id),
  external_job_id VARCHAR(255),
  source VARCHAR(50) NOT NULL,
  candidate_name VARCHAR(255),
  candidate_email VARCHAR(255),
  candidate_phone VARCHAR(50),
  resume_url TEXT,
  cover_letter TEXT,
  application_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'new',
  notes TEXT,
  raw_data JSONB DEFAULT '{}',
  processed_data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Job Board Search History
CREATE TABLE IF NOT EXISTS job_board_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  sources TEXT[] DEFAULT ARRAY[]::TEXT[],
  search_params JSONB DEFAULT '{}',
  results_count INTEGER DEFAULT 0,
  total_available INTEGER DEFAULT 0,
  results_saved INTEGER DEFAULT 0,
  campaign_id UUID REFERENCES sourcing_campaigns(id),
  search_duration INTEGER, -- in milliseconds
  errors JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Update sourced_candidates to better support job postings
ALTER TABLE sourced_candidates
ADD COLUMN IF NOT EXISTS external_job_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS job_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS salary_min INTEGER,
ADD COLUMN IF NOT EXISTS salary_max INTEGER,
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS posted_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS apply_url TEXT,
ADD COLUMN IF NOT EXISTS relevance_score DECIMAL(5,2) DEFAULT 0;

-- Update integrations table to support job board APIs
UPDATE user_integrations SET integration_id = 'indeed' WHERE integration_id = 'indeed-api';
UPDATE user_integrations SET integration_id = 'ziprecruiter' WHERE integration_id = 'ziprecruiter-api';

-- Insert default job board integrations if they don't exist
INSERT INTO user_integrations (user_id, integration_id, status, account_info)
SELECT u.id, 'indeed', 'disconnected', 'API integration for job posting and searching'
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_integrations ui
  WHERE ui.user_id = u.id AND ui.integration_id = 'indeed'
);

INSERT INTO user_integrations (user_id, integration_id, status, account_info)
SELECT u.id, 'ziprecruiter', 'disconnected', 'API integration for job posting and searching'
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_integrations ui
  WHERE ui.user_id = u.id AND ui.integration_id = 'ziprecruiter'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);
CREATE INDEX IF NOT EXISTS idx_job_postings_posted_by ON job_postings(posted_by);
CREATE INDEX IF NOT EXISTS idx_job_postings_sources ON job_postings USING GIN(sources);
CREATE INDEX IF NOT EXISTS idx_job_postings_created_at ON job_postings(created_at);

CREATE INDEX IF NOT EXISTS idx_job_board_configs_user_source ON job_board_configs(user_id, source);
CREATE INDEX IF NOT EXISTS idx_job_board_configs_status ON job_board_configs(status);

CREATE INDEX IF NOT EXISTS idx_external_job_applications_job_posting ON external_job_applications(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_external_job_applications_source ON external_job_applications(source);
CREATE INDEX IF NOT EXISTS idx_external_job_applications_status ON external_job_applications(status);

CREATE INDEX IF NOT EXISTS idx_job_board_searches_user_id ON job_board_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_job_board_searches_campaign_id ON job_board_searches(campaign_id);
CREATE INDEX IF NOT EXISTS idx_job_board_searches_created_at ON job_board_searches(created_at);

CREATE INDEX IF NOT EXISTS idx_sourced_candidates_external_job_id ON sourced_candidates(external_job_id);
CREATE INDEX IF NOT EXISTS idx_sourced_candidates_relevance_score ON sourced_candidates(relevance_score);
CREATE INDEX IF NOT EXISTS idx_sourced_candidates_apply_url ON sourced_candidates(apply_url);