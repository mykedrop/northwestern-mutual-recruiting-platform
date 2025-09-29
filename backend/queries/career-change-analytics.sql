-- Career Change Analytics Queries

-- 1. Overall Performance Metrics
CREATE OR REPLACE VIEW career_change_metrics AS
SELECT 
  COUNT(DISTINCT ccs.id) as total_scored,
  AVG(ccs.total_score) as avg_score,
  COUNT(DISTINCT CASE WHEN ccs.total_score >= 0.7 THEN ccs.id END) as high_scorers,
  COUNT(DISTINCT CASE WHEN ccs.profession_tier = 1 THEN ccs.id END) as tier1_count,
  COUNT(DISTINCT CASE WHEN ccs.profession_tier = 2 THEN ccs.id END) as tier2_count,
  COUNT(DISTINCT CASE WHEN ccs.profession_tier = 3 THEN ccs.id END) as tier3_count
FROM career_changer_scores ccs;

-- 2. Profession Performance
CREATE OR REPLACE VIEW profession_performance AS
SELECT 
  pm.profession_category,
  pm.tier,
  COUNT(ccs.id) as candidates_scored,
  AVG(ccs.total_score) as avg_score,
  MAX(ccs.total_score) as max_score,
  COUNT(CASE WHEN ccs.nurture_stage != 'not_started' THEN 1 END) as in_nurture
FROM profession_mappings pm
LEFT JOIN career_changer_scores ccs ON pm.profession_category = ccs.current_profession
GROUP BY pm.profession_category, pm.tier
ORDER BY pm.tier, avg_score DESC;

-- 3. Industry Distress Impact
CREATE OR REPLACE VIEW industry_impact AS
SELECT 
  ihs.industry_name,
  ihs.overall_distress_score,
  COUNT(ccs.id) as candidates_affected,
  AVG(ccs.total_score) as avg_candidate_score
FROM industry_health_scores ihs
JOIN career_changer_scores ccs ON ccs.industry_distress_score = ihs.overall_distress_score
GROUP BY ihs.industry_name, ihs.overall_distress_score
ORDER BY ihs.overall_distress_score DESC;



