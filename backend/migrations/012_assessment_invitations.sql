-- Assessment Invitations System Migration
-- This creates the infrastructure for professional email-based assessment invitations

-- Assessment invitations table
CREATE TABLE IF NOT EXISTS assessment_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL,
    recruiter_id UUID NOT NULL,
    assessment_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'completed', 'expired', 'failed')),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    email_sent BOOLEAN DEFAULT FALSE,
    sendgrid_message_id VARCHAR(255),
    resent_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_invitation_candidate
        FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    CONSTRAINT fk_invitation_assessment
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assessment_invitations_candidate_id ON assessment_invitations(candidate_id);
CREATE INDEX IF NOT EXISTS idx_assessment_invitations_recruiter_id ON assessment_invitations(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_assessment_invitations_status ON assessment_invitations(status);
CREATE INDEX IF NOT EXISTS idx_assessment_invitations_invited_at ON assessment_invitations(invited_at DESC);

-- Email tracking events table (for SendGrid webhooks)
CREATE TABLE IF NOT EXISTS assessment_email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invitation_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    email_address VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sendgrid_event_id VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    url TEXT,
    metadata JSONB,

    CONSTRAINT fk_email_event_invitation
        FOREIGN KEY (invitation_id) REFERENCES assessment_invitations(id) ON DELETE CASCADE
);

-- Index for email events
CREATE INDEX IF NOT EXISTS idx_assessment_email_events_invitation_id ON assessment_email_events(invitation_id);
CREATE INDEX IF NOT EXISTS idx_assessment_email_events_type ON assessment_email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_assessment_email_events_timestamp ON assessment_email_events(timestamp DESC);

-- Function to update assessment invitation status based on email events
CREATE OR REPLACE FUNCTION update_invitation_status_from_email_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the invitation status based on the email event
    CASE NEW.event_type
        WHEN 'delivered' THEN
            UPDATE assessment_invitations
            SET status = 'delivered', updated_at = NOW()
            WHERE id = NEW.invitation_id AND status = 'sent';

        WHEN 'open' THEN
            UPDATE assessment_invitations
            SET status = 'opened', updated_at = NOW()
            WHERE id = NEW.invitation_id AND status IN ('sent', 'delivered');

        WHEN 'click' THEN
            UPDATE assessment_invitations
            SET status = 'clicked', updated_at = NOW()
            WHERE id = NEW.invitation_id AND status IN ('sent', 'delivered', 'opened');

        WHEN 'bounce', 'dropped', 'spamreport' THEN
            UPDATE assessment_invitations
            SET status = 'failed', updated_at = NOW()
            WHERE id = NEW.invitation_id;

        ELSE
            -- For other events, just log but don't change status
            NULL;
    END CASE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for email events
DROP TRIGGER IF EXISTS trigger_update_invitation_status ON assessment_email_events;
CREATE TRIGGER trigger_update_invitation_status
    AFTER INSERT ON assessment_email_events
    FOR EACH ROW
    EXECUTE FUNCTION update_invitation_status_from_email_event();

-- Function to mark invitations as completed when assessment is completed
CREATE OR REPLACE FUNCTION update_invitation_on_assessment_complete()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE assessment_invitations
        SET status = 'completed', updated_at = NOW()
        WHERE assessment_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for assessment completion
DROP TRIGGER IF EXISTS trigger_invitation_assessment_complete ON assessments;
CREATE TRIGGER trigger_invitation_assessment_complete
    AFTER UPDATE ON assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_invitation_on_assessment_complete();

-- View for invitation analytics
CREATE OR REPLACE VIEW invitation_analytics AS
SELECT
    ai.recruiter_id,
    COUNT(*) as total_invitations,
    COUNT(*) FILTER (WHERE ai.status = 'sent') as sent_count,
    COUNT(*) FILTER (WHERE ai.status = 'delivered') as delivered_count,
    COUNT(*) FILTER (WHERE ai.status = 'opened') as opened_count,
    COUNT(*) FILTER (WHERE ai.status = 'clicked') as clicked_count,
    COUNT(*) FILTER (WHERE ai.status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE ai.status = 'failed') as failed_count,
    COUNT(*) FILTER (WHERE ai.status = 'expired') as expired_count,
    ROUND(
        (COUNT(*) FILTER (WHERE ai.status = 'opened')::DECIMAL /
         NULLIF(COUNT(*) FILTER (WHERE ai.status IN ('sent', 'delivered', 'opened', 'clicked', 'completed')), 0)) * 100,
        2
    ) as open_rate_percent,
    ROUND(
        (COUNT(*) FILTER (WHERE ai.status = 'clicked')::DECIMAL /
         NULLIF(COUNT(*) FILTER (WHERE ai.status IN ('opened', 'clicked', 'completed')), 0)) * 100,
        2
    ) as click_through_rate_percent,
    ROUND(
        (COUNT(*) FILTER (WHERE ai.status = 'completed')::DECIMAL /
         NULLIF(COUNT(*), 0)) * 100,
        2
    ) as completion_rate_percent
FROM assessment_invitations ai
GROUP BY ai.recruiter_id;

-- Sample email templates for assessment invitations
INSERT INTO outreach_templates (
    id,
    name,
    type,
    subject,
    body_template,
    is_active,
    created_at
) VALUES
(
    gen_random_uuid(),
    'Assessment Invitation - Professional',
    'assessment_invitation',
    'Your Northwestern Mutual Assessment - {{first_name}}',
    'Professional assessment invitation template with Northwestern Mutual branding',
    true,
    NOW()
),
(
    gen_random_uuid(),
    'Assessment Reminder - Follow Up',
    'assessment_reminder',
    'Reminder: Complete Your Northwestern Mutual Assessment - {{first_name}}',
    'Follow-up reminder template for assessment completion',
    true,
    NOW()
)
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON assessment_invitations TO northwestern_mutual_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON assessment_email_events TO northwestern_mutual_app;
GRANT SELECT ON invitation_analytics TO northwestern_mutual_app;

COMMENT ON TABLE assessment_invitations IS 'Tracks professional email invitations sent to candidates for behavioral assessments';
COMMENT ON TABLE assessment_email_events IS 'Stores email delivery events from SendGrid webhooks for tracking invitation effectiveness';
COMMENT ON VIEW invitation_analytics IS 'Provides recruiter analytics on assessment invitation performance and engagement rates';