-- Migration 003: Production Seed Data
-- Description: Seeds production data for Northwestern Mutual

-- Insert Northwestern Mutual organization (with conflict handling)
INSERT INTO organizations (name, domain)
VALUES ('Northwestern Mutual', 'northwestern.com')
ON CONFLICT (domain) DO NOTHING;

-- Create default admin user for Northwestern Mutual
INSERT INTO recruiters (
    email,
    first_name,
    last_name,
    role,
    organization_id,
    is_active
)
SELECT
    'admin@northwesternmutual.com',
    'System',
    'Administrator',
    'admin',
    o.id,
    true
FROM organizations o
WHERE o.name = 'Northwestern Mutual'
ON CONFLICT (email) DO NOTHING;

-- Insert sample employee data for Northwestern Mutual
INSERT INTO employees (
    employee_id,
    first_name,
    last_name,
    email,
    department,
    position,
    hire_date,
    performance_rating,
    success_level,
    organization_id
)
SELECT
    'NM' || LPAD(generate_series::text, 4, '0'),
    first_names.name,
    last_names.name,
    LOWER(first_names.name || '.' || last_names.name || '@northwesternmutual.com'),
    departments.dept,
    positions.pos,
    CURRENT_DATE - INTERVAL '1 year' * (RANDOM() * 10 + 1),
    ROUND((RANDOM() * 4 + 1)::NUMERIC, 2),
    CASE
        WHEN RANDOM() > 0.7 THEN 'high_performer'
        WHEN RANDOM() > 0.3 THEN 'average_performer'
        ELSE 'low_performer'
    END,
    o.id
FROM
    generate_series(1, 50) AS generate_series,
    (VALUES
        ('John'), ('Sarah'), ('Michael'), ('Emily'), ('David'),
        ('Jessica'), ('Robert'), ('Amanda'), ('Christopher'), ('Ashley'),
        ('Matthew'), ('Jennifer'), ('Joshua'), ('Elizabeth'), ('Daniel'),
        ('Lisa'), ('Anthony'), ('Nancy'), ('Mark'), ('Karen'),
        ('Paul'), ('Betty'), ('Steven'), ('Helen'), ('Andrew')
    ) AS first_names(name),
    (VALUES
        ('Smith'), ('Johnson'), ('Williams'), ('Brown'), ('Jones'),
        ('Garcia'), ('Miller'), ('Davis'), ('Rodriguez'), ('Martinez'),
        ('Hernandez'), ('Lopez'), ('Gonzalez'), ('Wilson'), ('Anderson'),
        ('Thomas'), ('Taylor'), ('Moore'), ('Jackson'), ('Martin')
    ) AS last_names(name),
    (VALUES
        ('Financial Planning'), ('Sales'), ('Risk Management'),
        ('Client Services'), ('Investment Advisory'), ('Operations'),
        ('Technology'), ('Human Resources'), ('Marketing'), ('Compliance')
    ) AS departments(dept),
    (VALUES
        ('Financial Advisor'), ('Senior Financial Advisor'), ('District Manager'),
        ('Client Associate'), ('Investment Specialist'), ('Operations Manager'),
        ('Software Engineer'), ('HR Business Partner'), ('Marketing Specialist'),
        ('Compliance Officer')
    ) AS positions(pos),
    organizations o
WHERE
    o.name = 'Northwestern Mutual'
    AND NOT EXISTS (
        SELECT 1 FROM employees
        WHERE employee_id = 'NM' || LPAD(generate_series::text, 4, '0')
    )
LIMIT 50;

-- Create a sample comparison baseline for high-performing financial advisors
INSERT INTO assessment_comparisons (
    comparison_name,
    description,
    employee_group_criteria,
    created_by,
    organization_id
)
SELECT
    'High-Performing Financial Advisors Baseline',
    'Assessment profile of top-performing financial advisors at Northwestern Mutual',
    '{"department": "Financial Planning", "success_level": "high_performer", "performance_rating": {"min": 4.0}}'::jsonb,
    r.id,
    o.id
FROM
    organizations o,
    recruiters r
WHERE
    o.name = 'Northwestern Mutual'
    AND r.email = 'admin@northwesternmutual.com'
    AND NOT EXISTS (
        SELECT 1 FROM assessment_comparisons
        WHERE comparison_name = 'High-Performing Financial Advisors Baseline'
    );

-- Insert sample performance metrics for employees
INSERT INTO employee_performance_metrics (
    employee_id,
    metric_type,
    metric_value,
    metric_period,
    period_start_date,
    period_end_date,
    organization_id
)
SELECT
    e.id,
    metrics.metric_type,
    ROUND((RANDOM() * 100000 + 50000)::NUMERIC, 2), -- Random revenue between 50k-150k
    'annual',
    DATE_TRUNC('year', CURRENT_DATE),
    DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day',
    e.organization_id
FROM
    employees e,
    (VALUES
        ('sales_revenue'),
        ('client_retention_rate'),
        ('new_client_acquisitions'),
        ('client_satisfaction_score')
    ) AS metrics(metric_type)
WHERE
    e.department IN ('Financial Planning', 'Sales')
    AND NOT EXISTS (
        SELECT 1 FROM employee_performance_metrics epm
        WHERE epm.employee_id = e.id AND epm.metric_type = metrics.metric_type
    )
LIMIT 200;

-- Create insight templates for behavioral assessments
CREATE TABLE IF NOT EXISTS insight_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dimension VARCHAR(100) NOT NULL,
    score_range VARCHAR(20) NOT NULL,
    insight_text TEXT NOT NULL,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert insight templates
INSERT INTO insight_templates (dimension, score_range, insight_text, category) VALUES
('leadership_potential', 'high', 'Shows strong natural leadership abilities with confidence in decision-making and team guidance.', 'strength'),
('leadership_potential', 'medium', 'Demonstrates moderate leadership capabilities with room for development in team management.', 'development'),
('leadership_potential', 'low', 'May prefer individual contributor roles; leadership skills require significant development.', 'consideration'),
('analytical_thinking', 'high', 'Excels at problem-solving and data analysis; strong strategic thinking abilities.', 'strength'),
('analytical_thinking', 'medium', 'Shows good analytical skills with potential for enhancement through training.', 'development'),
('analytical_thinking', 'low', 'May struggle with complex analysis; benefits from structured problem-solving approaches.', 'consideration'),
('interpersonal_skills', 'high', 'Natural relationship builder with excellent communication and empathy skills.', 'strength'),
('interpersonal_skills', 'medium', 'Good social skills with opportunity to enhance client relationship capabilities.', 'development'),
('interpersonal_skills', 'low', 'May find client-facing roles challenging; requires interpersonal skill development.', 'consideration'),
('stress_tolerance', 'high', 'Maintains composure under pressure; thrives in high-demand environments.', 'strength'),
('stress_tolerance', 'medium', 'Handles moderate stress well; may need support during peak demand periods.', 'development'),
('stress_tolerance', 'low', 'Sensitive to stress; requires structured environment and stress management support.', 'consideration')
ON CONFLICT DO NOTHING;

-- Create notification for admin about system setup
INSERT INTO notifications (
    recruiter_id,
    type,
    title,
    message,
    data
)
SELECT
    r.id,
    'system_setup',
    'Northwestern Mutual Recruiting Platform Ready',
    'Your recruiting platform has been successfully deployed with OAuth authentication, employee assessment comparisons, and full functionality.',
    '{"features": ["OAuth Authentication", "Employee Assessments", "Candidate Comparisons", "Intelligence Reports"], "next_steps": ["Configure OAuth credentials", "Import employee data", "Set up assessment baselines"]}'::jsonb
FROM recruiters r
WHERE r.email = 'admin@northwesternmutual.com'
ON CONFLICT DO NOTHING;