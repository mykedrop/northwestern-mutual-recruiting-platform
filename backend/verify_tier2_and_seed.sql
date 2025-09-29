-- 1. Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%signal%' OR table_name = 'candidates' OR table_name = 'sourced_candidates')
ORDER BY table_name;

-- 2. Check if we have any sourced candidates
SELECT COUNT(*) as sourced_count FROM sourced_candidates;

-- 3. Get a few sourced candidate IDs
SELECT id, full_name, name, title, company FROM sourced_candidates LIMIT 5;

-- 4. Add test signals for existing sourced candidates
DO $$
DECLARE
    candidate_record RECORD;
    signal_count INTEGER := 0;
BEGIN
    FOR candidate_record IN 
        SELECT id, COALESCE(full_name, name) as full_name FROM sourced_candidates LIMIT 10
    LOOP
        -- OpenToWork
        IF random() > 0.5 THEN
            INSERT INTO job_seeking_signals 
            (candidate_id, signal_type, signal_strength, signal_data, expires_at)
            VALUES (
                candidate_record.id,
                'open_to_work_badge',
                1.0,
                '{"detected_from": "seed"}'::jsonb,
                NOW() + INTERVAL '30 days'
            )
            ON CONFLICT (candidate_id, signal_type) DO NOTHING;
            signal_count := signal_count + 1;
        END IF;

        -- bio keywords
        IF random() > 0.4 THEN
            INSERT INTO job_seeking_signals 
            (candidate_id, signal_type, signal_strength, signal_data, expires_at)
            VALUES (
                candidate_record.id,
                'looking_in_bio',
                0.8,
                '{"keyword": "seeking new opportunities"}'::jsonb,
                NOW() + INTERVAL '30 days'
            )
            ON CONFLICT (candidate_id, signal_type) DO NOTHING;
            signal_count := signal_count + 1;
        END IF;

        -- recent profile update
        IF random() > 0.6 THEN
            INSERT INTO job_seeking_signals 
            (candidate_id, signal_type, signal_strength, signal_data, expires_at)
            VALUES (
                candidate_record.id,
                'recent_profile_update',
                0.7,
                '{"days_ago": 5}'::jsonb,
                NOW() + INTERVAL '14 days'
            )
            ON CONFLICT (candidate_id, signal_type) DO NOTHING;
            signal_count := signal_count + 1;
        END IF;

        -- title change
        IF random() > 0.7 THEN
            INSERT INTO job_seeking_signals 
            (candidate_id, signal_type, signal_strength, signal_data, expires_at)
            VALUES (
                candidate_record.id,
                'title_change',
                0.6,
                '{"previous_role": "Senior Advisor"}'::jsonb,
                NOW() + INTERVAL '21 days'
            )
            ON CONFLICT (candidate_id, signal_type) DO NOTHING;
            signal_count := signal_count + 1;
        END IF;
    END LOOP;
    RAISE NOTICE 'Added % test signals', signal_count;
END $$;

-- 5. Verify signals
SELECT 
    signal_type,
    COUNT(*) as count,
    AVG(signal_strength) as avg_strength,
    MIN(expires_at) as earliest_expiry
FROM job_seeking_signals
WHERE expires_at > NOW()
GROUP BY signal_type
ORDER BY count DESC;

-- 6. Check candidate_signal_scores view
SELECT 
    candidate_id,
    full_name,
    ROUND(job_seeking_score::numeric, 2) as score,
    active_signals,
    signal_types
FROM candidate_signal_scores
WHERE job_seeking_score > 0
ORDER BY job_seeking_score DESC
LIMIT 10;

-- 7. Weights
SELECT * FROM signal_weights ORDER BY base_weight DESC;
