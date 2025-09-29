-- Phase 5 Tier 2: Signal Detection Weights and Scores View (compatible with existing schema)

-- Create signal_weights table
CREATE TABLE IF NOT EXISTS signal_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type VARCHAR(100) NOT NULL UNIQUE,
  base_weight DECIMAL(3,2) DEFAULT 0.50,
  decay_rate DECIMAL(3,2) DEFAULT 0.10,
  max_age_days INTEGER DEFAULT 30,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed default weights (idempotent)
INSERT INTO signal_weights (signal_type, base_weight, decay_rate, max_age_days, description)
VALUES
  ('open_to_work_badge', 1.00, 0.05, 60, 'LinkedIn OpenToWork badge active'),
  ('looking_in_bio',     0.80, 0.10, 30, 'Bio/summary keywords like seeking/open to'),
  ('recent_profile_update', 0.60, 0.20, 14, 'Profile updated recently'),
  ('title_change',       0.70, 0.15, 21, 'Recent job title change'),
  ('multiple_job_views', 0.50, 0.25, 7,  'Viewed multiple job postings'),
  ('posted_resume',      0.90, 0.10, 30, 'Uploaded resume recently'),
  ('former_in_title',    0.80, 0.10, 45, 'Title contains Former / Ex-'),
  ('actively_applying',  0.90, 0.10, 30, 'Actively applying to roles')
ON CONFLICT (signal_type) DO NOTHING;

-- Uses existing job_seeking_signals (candidate_id references sourced_candidates.id)
-- Ensure we can replace even if column types changed by dropping first
DROP VIEW IF EXISTS candidate_signal_scores CASCADE;

CREATE OR REPLACE VIEW candidate_signal_scores AS
SELECT
  sc.id AS candidate_id,
  COALESCE(sc.full_name, sc.name) AS full_name,
  sc.email,
  -- Weighted, decayed average of active signals
  COALESCE(
    AVG(
      CASE 
        WHEN jss.expires_at > NOW() THEN 
          -- decay based on days since detection, never below 0
          (jss.signal_strength * COALESCE(sw.base_weight, 0.50)) * 
          GREATEST(0, 1 - COALESCE(sw.decay_rate, 0.10) * GREATEST(0, EXTRACT(DAY FROM (NOW() - jss.detected_at))))
        ELSE 0
      END
    ), 0
  ) AS job_seeking_score,
  COUNT(DISTINCT CASE WHEN jss.expires_at > NOW() THEN jss.signal_type END) AS active_signals,
  MAX(jss.detected_at) AS last_signal_detected,
  ARRAY_AGG(DISTINCT jss.signal_type) FILTER (WHERE jss.expires_at > NOW()) AS signal_types
FROM sourced_candidates sc
LEFT JOIN job_seeking_signals jss ON sc.id = jss.candidate_id
LEFT JOIN signal_weights sw ON jss.signal_type = sw.signal_type
GROUP BY sc.id, sc.full_name, sc.name, sc.email;

-- Performance indexes (safe if already exist)
CREATE INDEX IF NOT EXISTS idx_signal_weights_type ON signal_weights(signal_type);
CREATE INDEX IF NOT EXISTS idx_css_candidate_id ON job_seeking_signals(candidate_id);
CREATE INDEX IF NOT EXISTS idx_css_detected_at ON job_seeking_signals(detected_at);
CREATE INDEX IF NOT EXISTS idx_css_expires_at ON job_seeking_signals(expires_at);


