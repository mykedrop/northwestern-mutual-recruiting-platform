-- Sourcing Campaigns
CREATE TABLE IF NOT EXISTS sourcing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  criteria JSONB DEFAULT '{}',
  sources TEXT[] DEFAULT ARRAY['linkedin'],
  status VARCHAR(20) DEFAULT 'active',
  daily_limit INTEGER DEFAULT 50,
  total_sourced INTEGER DEFAULT 0,
  total_qualified INTEGER DEFAULT 0,
  total_contacted INTEGER DEFAULT 0,
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sourced Candidates
CREATE TABLE IF NOT EXISTS sourced_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL,
  source_url TEXT,
  linkedin_url TEXT UNIQUE,
  name VARCHAR(255),
  title VARCHAR(255),
  company VARCHAR(255),
  location VARCHAR(255),
  raw_data JSONB DEFAULT '{}',
  processed_data JSONB DEFAULT '{}',
  score DECIMAL(5,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'new',
  campaign_id UUID REFERENCES sourcing_campaigns(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_sourced_candidates_source ON sourced_candidates(source);
CREATE INDEX idx_sourced_candidates_status ON sourced_candidates(status);
CREATE INDEX idx_sourced_candidates_campaign ON sourced_candidates(campaign_id);


