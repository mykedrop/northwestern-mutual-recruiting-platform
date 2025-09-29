-- Align existing sourced_candidates table with sourcing spec without disrupting existing data

-- Add missing columns if they do not exist
ALTER TABLE IF EXISTS sourced_candidates
  ADD COLUMN IF NOT EXISTS source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS company VARCHAR(255),
  ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS processed_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS score DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS campaign_id UUID;

-- Indexes for performance (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sourced_candidates_linkedin_url ON sourced_candidates(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_sourced_candidates_source ON sourced_candidates(source);
CREATE INDEX IF NOT EXISTS idx_sourced_candidates_campaign ON sourced_candidates(campaign_id);

-- Foreign key to sourcing_campaigns (idempotent via exception guard)
DO $$
BEGIN
  ALTER TABLE sourced_candidates
    ADD CONSTRAINT sourced_candidates_campaign_id_fkey
    FOREIGN KEY (campaign_id) REFERENCES sourcing_campaigns(id);
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists; do nothing
  NULL;
END $$;


