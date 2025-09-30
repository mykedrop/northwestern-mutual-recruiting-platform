-- Migration 002: Employee Assessment System
-- Description: Adds employee management and assessment comparison capabilities

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(50) UNIQUE NOT NULL, -- Northwestern Mutual employee ID
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    department VARCHAR(100),
    position VARCHAR(100),
    hire_date DATE,
    manager_id UUID REFERENCES employees(id),
    performance_rating NUMERIC(3,2), -- Latest performance rating (1.0-5.0)
    success_level VARCHAR(20) DEFAULT 'unknown', -- high_performer, average_performer, low_performer, unknown
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id)
);

-- Add assessment_type to assessments table to distinguish employee vs candidate assessments
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS assessment_type VARCHAR(20) DEFAULT 'candidate';
-- Values: 'candidate', 'employee', 'employee_baseline'

-- Add employee_id to assessments table
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id);

-- Create employee performance metrics table
CREATE TABLE IF NOT EXISTS employee_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL, -- sales_revenue, client_retention, team_leadership, etc.
    metric_value NUMERIC(10,2) NOT NULL,
    metric_period VARCHAR(20) NOT NULL, -- quarterly, annual, etc.
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id)
);

-- Create assessment comparison analytics table
CREATE TABLE IF NOT EXISTS assessment_comparisons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comparison_name VARCHAR(100) NOT NULL,
    description TEXT,
    employee_group_criteria JSONB, -- Criteria for selecting high-performing employees
    baseline_assessment_ids UUID[], -- Array of employee assessment IDs used as baseline
    created_by UUID REFERENCES recruiters(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id)
);

-- Create candidate comparison scores table
CREATE TABLE IF NOT EXISTS candidate_comparison_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    comparison_id UUID NOT NULL REFERENCES assessment_comparisons(id) ON DELETE CASCADE,
    overall_similarity_score NUMERIC(5,2) NOT NULL, -- 0-100 similarity to high performers
    dimension_similarity_scores JSONB, -- Per-dimension similarity scores
    fit_recommendation VARCHAR(20), -- strong_fit, moderate_fit, poor_fit
    confidence_level NUMERIC(3,2), -- 0-1 confidence in recommendation
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_success_level ON employees(success_level);
CREATE INDEX IF NOT EXISTS idx_employees_organization ON employees(organization_id);

CREATE INDEX IF NOT EXISTS idx_assessments_employee_id ON assessments(employee_id);
CREATE INDEX IF NOT EXISTS idx_assessments_type ON assessments(assessment_type);
CREATE INDEX IF NOT EXISTS idx_assessments_type_employee ON assessments(assessment_type, employee_id) WHERE assessment_type = 'employee';

CREATE INDEX IF NOT EXISTS idx_performance_metrics_employee ON employee_performance_metrics(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_type ON employee_performance_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_period ON employee_performance_metrics(period_start_date, period_end_date);

CREATE INDEX IF NOT EXISTS idx_comparison_scores_candidate ON candidate_comparison_scores(candidate_id);
CREATE INDEX IF NOT EXISTS idx_comparison_scores_assessment ON candidate_comparison_scores(assessment_id);
CREATE INDEX IF NOT EXISTS idx_comparison_scores_comparison ON candidate_comparison_scores(comparison_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER IF NOT EXISTS update_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_assessment_comparisons_updated_at
    BEFORE UPDATE ON assessment_comparisons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_recruiters_updated_at
    BEFORE UPDATE ON recruiters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE employees IS 'Northwestern Mutual employee records for assessment comparison';
COMMENT ON TABLE employee_performance_metrics IS 'Performance metrics for employees to correlate with assessment results';
COMMENT ON TABLE assessment_comparisons IS 'Defined comparison groups for measuring candidate fit';
COMMENT ON TABLE candidate_comparison_scores IS 'Similarity scores between candidates and employee baselines';