-- Seed data for Career Change System

-- Insert Profession Mappings (Tier 1 - Highest Success)
INSERT INTO profession_mappings (profession_category, tier, current_titles, industries, key_skills, search_keywords, exclusion_terms, messaging_hooks) VALUES
('Insurance Professionals', 1, 
 ARRAY['Insurance Agent', 'Insurance Broker', 'Account Executive', 'Sales Representative', 'Client Advisor'],
 ARRAY['Insurance', 'Risk Management'],
 ARRAY['relationship building', 'consultative selling', 'risk assessment', 'client needs analysis'],
 ARRAY['insurance agent', 'insurance sales', 'insurance broker', 'account executive insurance'],
 ARRAY['entry level', 'intern', 'assistant'],
 '{"primary": "unlimited earning potential", "secondary": "build your own book", "pain_point": "tired of carrier restrictions"}'::JSONB
),
('B2B Sales Professionals', 1,
 ARRAY['Sales Manager', 'Account Executive', 'Business Development', 'Sales Director', 'Territory Manager'],
 ARRAY['Technology', 'Manufacturing', 'Services', 'Healthcare'],
 ARRAY['solution selling', 'pipeline management', 'relationship building', 'negotiation'],
 ARRAY['B2B sales', 'account executive', 'sales manager', 'business development'],
 ARRAY['retail', 'inside sales', 'call center'],
 '{"primary": "control your income", "secondary": "long-term client relationships", "pain_point": "tired of quotas and territories"}'::JSONB
),
('Educators', 2,
 ARRAY['Teacher', 'Professor', 'Instructor', 'Educator', 'Academic Advisor'],
 ARRAY['Education', 'Higher Education', 'K-12'],
 ARRAY['communication', 'mentoring', 'planning', 'relationship building'],
 ARRAY['teacher', 'educator', 'professor', 'instructor'],
 ARRAY['substitute', 'aide', 'assistant'],
 '{"primary": "make a real impact", "secondary": "summers and evenings free", "pain_point": "undervalued and underpaid"}'::JSONB
),
('Military Veterans', 2,
 ARRAY['Military Officer', 'Sergeant', 'Veteran', 'Service Member'],
 ARRAY['Military', 'Defense', 'Government'],
 ARRAY['leadership', 'discipline', 'strategic planning', 'team building'],
 ARRAY['veteran', 'military', 'officer', 'sergeant', 'service member'],
 ARRAY['active duty'],
 '{"primary": "continue serving your community", "secondary": "leadership skills valued", "pain_point": "difficult civilian transition"}'::JSONB
),
('Small Business Owners', 3,
 ARRAY['Owner', 'Founder', 'CEO', 'President', 'Principal'],
 ARRAY['Retail', 'Services', 'Hospitality', 'Construction'],
 ARRAY['entrepreneurship', 'P&L management', 'client relationships', 'business development'],
 ARRAY['business owner', 'founder', 'CEO small', 'president'],
 ARRAY['Fortune 500', 'corporation'],
 '{"primary": "proven entrepreneurial success", "secondary": "scalable business model", "pain_point": "plateau in current business"}'::JSONB
);

-- Insert Industry Health Scores
INSERT INTO industry_health_scores (industry_name, automation_risk_score, recent_layoffs_count, layoff_trend, market_growth_rate, regulatory_pressure_score, overall_distress_score, data_source) VALUES
('Insurance', 0.65, 15000, 'increasing', -2.5, 0.70, 0.68, 'BLS + Industry Reports'),
('Retail', 0.80, 45000, 'increasing', -5.0, 0.40, 0.75, 'BLS + Industry Reports'),
('Education', 0.30, 8000, 'stable', 1.0, 0.60, 0.45, 'BLS + Industry Reports'),
('Manufacturing', 0.70, 25000, 'increasing', -1.0, 0.50, 0.65, 'BLS + Industry Reports'),
('Technology', 0.40, 120000, 'increasing', 3.0, 0.30, 0.55, 'Industry Reports');

-- Insert Career Change Indicators
INSERT INTO career_change_indicators (indicator_type, indicator_name, weight, detection_pattern, linkedin_signals) VALUES
('personal_trigger', 'LinkedIn #OpenToWork', 0.40, 'Has #OpenToWork badge on LinkedIn', ARRAY['#OpenToWork', 'open to opportunities']),
('personal_trigger', 'Recent Profile Updates', 0.20, 'Updated LinkedIn profile in last 30 days', ARRAY['profile update', 'new headline']),
('career_plateau', 'Same Role 5+ Years', 0.25, 'No promotion or role change in 5+ years', ARRAY['5+ years same position']),
('industry_distress', 'Company Layoffs', 0.35, 'Company announced layoffs', ARRAY['company downsizing', 'restructuring']),
('skill_match', 'Has Sales Experience', 0.30, 'Profile mentions sales or business development', ARRAY['sales', 'business development', 'quota']);

-- Insert Career Change Templates for Insurance Professionals
INSERT INTO career_change_templates (profession_category, tier, template_type, subject_line, email_template, personalization_variables) VALUES
('Insurance Professionals', 1, 'initial_outreach',
 '{{firstName}}, your insurance expertise could mean more at Northwestern Mutual',
 'Hi {{firstName}},

I noticed you''ve built an impressive {{yearsExperience}} years in insurance at {{currentCompany}}. 

Many insurance professionals don''t realize they could be earning 2-3x more by transitioning to comprehensive financial planning while using the same relationship-building skills.

{{specificAchievement}}

Would you be open to a brief conversation about how Northwestern Mutual advisors with insurance backgrounds are building $500K+ practices?

Best regards,
{{recruiterName}}',
 ARRAY['firstName', 'yearsExperience', 'currentCompany', 'specificAchievement', 'recruiterName']
),
('Insurance Professionals', 1, 'follow_up_1',
 'Quick question about your career goals, {{firstName}}',
 'Hi {{firstName}},

I wanted to follow up on my previous message. I''m specifically reaching out because Northwestern Mutual is actively seeking experienced insurance professionals who are ready to control their earning potential.

Our insurance-to-advisor transition program has a 73% success rate because professionals like you already have the core skills:
• Explaining complex products simply
• Building trust with clients  
• Managing compliance requirements

Would a 15-minute call this week work to explore if this could be a fit?

{{recruiterName}}',
 ARRAY['firstName', 'recruiterName']
);



