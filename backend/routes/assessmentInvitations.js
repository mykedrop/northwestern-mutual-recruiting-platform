const router = require('express').Router();
const AssessmentInvitationService = require('../services/assessmentInvitationService');
const auth = require('../middleware/auth');
const db = require('../config/database');

const invitationService = new AssessmentInvitationService();

// All routes require authentication
router.use(auth);

// Send assessment invitation to candidate
router.post('/send', async (req, res) => {
    try {
        const { candidateId, customSubject, customMessage } = req.body;
        const recruiterId = req.user.userId;

        if (!candidateId) {
            return res.status(400).json({
                success: false,
                error: 'candidateId is required'
            });
        }

        // Check if candidate exists and belongs to recruiter
        const candidateCheck = await db.query(
            'SELECT * FROM candidates WHERE id = $1 AND recruiter_id = $2',
            [candidateId, recruiterId]
        );

        if (candidateCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Candidate not found or access denied'
            });
        }

        // Check for existing active invitation
        const existingInvitation = await db.query(
            `SELECT * FROM assessment_invitations
             WHERE candidate_id = $1 AND status NOT IN ('completed', 'failed', 'expired')
             ORDER BY invited_at DESC LIMIT 1`,
            [candidateId]
        );

        if (existingInvitation.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Active invitation already exists for this candidate',
                existing: existingInvitation.rows[0]
            });
        }

        const options = {};
        if (customSubject) options.customSubject = customSubject;
        if (customMessage) options.customMessage = customMessage;

        const result = await invitationService.sendAssessmentInvitation(
            candidateId,
            recruiterId,
            options
        );

        res.json({
            success: true,
            message: 'Assessment invitation sent successfully',
            data: result
        });

    } catch (error) {
        console.error('Send invitation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send assessment invitation',
            details: error.message
        });
    }
});

// Generate assessment link without sending email (for manual sharing)
router.post('/generate-link', async (req, res) => {
    try {
        const { candidateId } = req.body;
        const recruiterId = req.user.userId;

        if (!candidateId) {
            return res.status(400).json({
                success: false,
                error: 'candidateId is required'
            });
        }

        // Verify candidate access
        const candidateCheck = await db.query(
            'SELECT * FROM candidates WHERE id = $1 AND recruiter_id = $2',
            [candidateId, recruiterId]
        );

        if (candidateCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Candidate not found or access denied'
            });
        }

        const linkData = await invitationService.generateAssessmentLink(candidateId);

        res.json({
            success: true,
            assessmentUrl: linkData.url,
            assessmentId: linkData.assessmentId,
            candidate: candidateCheck.rows[0]
        });

    } catch (error) {
        console.error('Generate link error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate assessment link',
            details: error.message
        });
    }
});

// Get invitation status
router.get('/status/:invitationId', async (req, res) => {
    try {
        const { invitationId } = req.params;
        const recruiterId = req.user.userId;

        const invitation = await invitationService.getInvitationStatus(invitationId);

        if (!invitation) {
            return res.status(404).json({
                success: false,
                error: 'Invitation not found'
            });
        }

        // Check if recruiter owns this invitation
        if (invitation.recruiter_id !== recruiterId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Get email tracking events
        const emailEvents = await db.query(
            `SELECT event_type, timestamp, url, user_agent, ip_address
             FROM assessment_email_events
             WHERE invitation_id = $1
             ORDER BY timestamp DESC`,
            [invitationId]
        );

        res.json({
            success: true,
            invitation,
            emailEvents: emailEvents.rows
        });

    } catch (error) {
        console.error('Get invitation status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get invitation status',
            details: error.message
        });
    }
});

// Get all invitations for recruiter
router.get('/my-invitations', async (req, res) => {
    try {
        const recruiterId = req.user.userId;
        const { limit = 50, status, candidateId } = req.query;

        let query = `
            SELECT ai.*, c.first_name, c.last_name, c.email,
                   a.status as assessment_status, a.completion_percentage, a.end_time
            FROM assessment_invitations ai
            JOIN candidates c ON ai.candidate_id = c.id
            LEFT JOIN assessments a ON ai.assessment_id = a.id
            WHERE ai.recruiter_id = $1
        `;

        const params = [recruiterId];
        let paramCount = 1;

        if (status) {
            paramCount++;
            query += ` AND ai.status = $${paramCount}`;
            params.push(status);
        }

        if (candidateId) {
            paramCount++;
            query += ` AND ai.candidate_id = $${paramCount}`;
            params.push(candidateId);
        }

        query += ` ORDER BY ai.invited_at DESC LIMIT $${paramCount + 1}`;
        params.push(parseInt(limit));

        const invitations = await db.query(query, params);

        res.json({
            success: true,
            invitations: invitations.rows,
            count: invitations.rows.length
        });

    } catch (error) {
        console.error('Get invitations error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get invitations',
            details: error.message
        });
    }
});

// Resend invitation
router.post('/resend/:invitationId', async (req, res) => {
    try {
        const { invitationId } = req.params;
        const recruiterId = req.user.userId;

        const result = await invitationService.resendInvitation(invitationId, recruiterId);

        res.json({
            success: true,
            message: 'Assessment invitation resent successfully',
            data: result
        });

    } catch (error) {
        console.error('Resend invitation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resend invitation',
            details: error.message
        });
    }
});

// Get candidate's assessment link (for display in candidate card)
router.get('/candidate-link/:candidateId', async (req, res) => {
    try {
        const { candidateId } = req.params;
        const recruiterId = req.user.userId;

        // Verify candidate access
        const candidateCheck = await db.query(
            'SELECT * FROM candidates WHERE id = $1 AND recruiter_id = $2',
            [candidateId, recruiterId]
        );

        if (candidateCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Candidate not found or access denied'
            });
        }

        // Check for existing assessment/invitation
        const assessmentCheck = await db.query(
            `SELECT a.*, ai.status as invitation_status, ai.invited_at, ai.expires_at
             FROM assessments a
             LEFT JOIN assessment_invitations ai ON a.id = ai.assessment_id
             WHERE a.candidate_id = $1
             ORDER BY a.created_at DESC LIMIT 1`,
            [candidateId]
        );

        let assessmentUrl = null;
        let assessmentStatus = null;
        let invitationStatus = null;

        if (assessmentCheck.rows.length > 0) {
            const assessment = assessmentCheck.rows[0];
            assessmentUrl = `${process.env.FRONTEND_URL}/assessment.html?candidateId=${candidateId}&assessmentId=${assessment.id}`;
            assessmentStatus = assessment.status;
            invitationStatus = assessment.invitation_status;
        } else {
            // Generate new link if none exists
            const linkData = await invitationService.generateAssessmentLink(candidateId);
            assessmentUrl = linkData.url;
            assessmentStatus = 'not_started';
        }

        res.json({
            success: true,
            candidateId,
            assessmentUrl,
            assessmentStatus,
            invitationStatus,
            candidate: candidateCheck.rows[0]
        });

    } catch (error) {
        console.error('Get candidate link error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get candidate assessment link',
            details: error.message
        });
    }
});

// Invitation analytics for recruiter
router.get('/analytics', async (req, res) => {
    try {
        const recruiterId = req.user.userId;

        const analytics = await db.query(
            'SELECT * FROM invitation_analytics WHERE recruiter_id = $1',
            [recruiterId]
        );

        // Additional detailed stats
        const recentActivity = await db.query(
            `SELECT ai.status, COUNT(*) as count,
                    DATE_TRUNC('day', ai.invited_at) as date
             FROM assessment_invitations ai
             WHERE ai.recruiter_id = $1
               AND ai.invited_at >= NOW() - INTERVAL '30 days'
             GROUP BY ai.status, DATE_TRUNC('day', ai.invited_at)
             ORDER BY date DESC`,
            [recruiterId]
        );

        res.json({
            success: true,
            analytics: analytics.rows[0] || {
                recruiter_id: recruiterId,
                total_invitations: 0,
                sent_count: 0,
                delivered_count: 0,
                opened_count: 0,
                clicked_count: 0,
                completed_count: 0,
                failed_count: 0,
                expired_count: 0,
                open_rate_percent: 0,
                click_through_rate_percent: 0,
                completion_rate_percent: 0
            },
            recentActivity: recentActivity.rows
        });

    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get invitation analytics',
            details: error.message
        });
    }
});

// SendGrid webhook for email events
router.post('/webhook/sendgrid', async (req, res) => {
    try {
        const events = req.body;

        for (const event of events) {
            const customArgs = event.customArgs || {};
            const invitationId = customArgs.messageId;

            if (!invitationId) continue;

            // Store email event
            await db.query(`
                INSERT INTO assessment_email_events
                (invitation_id, event_type, email_address, timestamp, sendgrid_event_id,
                 user_agent, ip_address, url, metadata)
                VALUES ($1, $2, $3, to_timestamp($4), $5, $6, $7, $8, $9)
            `, [
                invitationId,
                event.event,
                event.email,
                event.timestamp,
                event.sg_event_id,
                event.useragent,
                event.ip,
                event.url,
                JSON.stringify(event)
            ]);

            // Emit real-time update to recruiter
            const invitationData = await db.query(
                'SELECT recruiter_id, candidate_id FROM assessment_invitations WHERE id = $1',
                [invitationId]
            );

            if (invitationData.rows.length > 0) {
                const { recruiter_id, candidate_id } = invitationData.rows[0];
                const io = require('../server').io;

                if (io) {
                    io.to(`recruiter-${recruiter_id}`).emit('invitation-event', {
                        invitationId,
                        candidateId: candidate_id,
                        eventType: event.event,
                        timestamp: new Date(event.timestamp * 1000)
                    });
                }
            }
        }

        res.status(200).send('OK');

    } catch (error) {
        console.error('SendGrid webhook error:', error);
        res.status(500).send('Error processing webhook');
    }
});

module.exports = router;