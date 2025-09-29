-- Ensure columns exist for bulk actions features
ALTER TABLE IF EXISTS sourced_candidates
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS imported_to_candidate BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS candidate_id INTEGER;

-- Optional index to speed up tagging queries
CREATE INDEX IF NOT EXISTS idx_sourced_candidates_tags ON sourced_candidates USING GIN (tags);


