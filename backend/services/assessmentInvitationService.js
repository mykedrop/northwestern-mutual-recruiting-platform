const db = require('../config/database');
const EmailService = require('./outreach/emailService');
const { v4: uuidv4 } = require('uuid');

class AssessmentInvitationService {
    constructor() {
        this.emailService = new EmailService();
    }

    async sendAssessmentInvitation(candidateId, recruiterId, options = {}) {
        try {
            // Get candidate details
            const candidateResult = await db.query(
                'SELECT * FROM candidates WHERE id = $1',
                [candidateId]
            );

            if (candidateResult.rows.length === 0) {
                throw new Error('Candidate not found');
            }

            const candidate = candidateResult.rows[0];

            // Get recruiter details
            const recruiterResult = await db.query(
                'SELECT * FROM users WHERE id = $1',
                [recruiterId]
            );

            const recruiter = recruiterResult.rows[0] || {
                first_name: 'Recruiting',
                last_name: 'Team',
                email: 'recruiting@northwestern.com'
            };

            // Generate assessment launch URL
            const launchResponse = await this.generateAssessmentLink(candidateId);
            const assessmentUrl = launchResponse.url;
            const assessmentId = launchResponse.assessmentId;

            // Create invitation record
            const invitationId = uuidv4();
            await db.query(`
                INSERT INTO assessment_invitations
                (id, candidate_id, recruiter_id, assessment_id, status, invited_at, expires_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '7 days')
            `, [invitationId, candidateId, recruiterId, assessmentId, 'sent']);

            // Generate professional email
            const emailContent = this.generateAssessmentEmailTemplate(
                candidate,
                recruiter,
                assessmentUrl,
                options
            );

            // Send email
            const emailResult = await this.emailService.sendEmail(
                candidate.email,
                emailContent.subject,
                emailContent.html,
                invitationId
            );

            // Update invitation with email details
            await db.query(`
                UPDATE assessment_invitations
                SET email_sent = true, sendgrid_message_id = $1
                WHERE id = $2
            `, [emailResult.messageId, invitationId]);

            // Emit real-time update to recruiter dashboard
            const io = require('../server').io;
            if (io) {
                io.to(`recruiter-${recruiterId}`).emit('assessment-invitation-sent', {
                    candidateId,
                    candidateName: `${candidate.first_name} ${candidate.last_name}`,
                    email: candidate.email,
                    invitationId,
                    assessmentUrl
                });
            }

            return {
                success: true,
                invitationId,
                assessmentId,
                assessmentUrl,
                emailMessageId: emailResult.messageId,
                candidate: {
                    id: candidate.id,
                    name: `${candidate.first_name} ${candidate.last_name}`,
                    email: candidate.email
                }
            };

        } catch (error) {
            console.error('Assessment invitation error:', error);
            throw error;
        }
    }

    async generateAssessmentLink(candidateId) {
        try {
            // Direct generation approach (more reliable than HTTP call)
            const assessmentId = uuidv4();

            // Check if assessment already exists for this candidate
            const existingAssessment = await db.query(
                'SELECT * FROM assessments WHERE candidate_id = $1 AND status != \'completed\'',
                [candidateId]
            );

            if (existingAssessment.rows.length > 0) {
                const assessment = existingAssessment.rows[0];
                return {
                    assessmentId: assessment.id,
                    url: `${process.env.FRONTEND_URL}/assessment.html?candidateId=${candidateId}&assessmentId=${assessment.id}`
                };
            }

            // Create new assessment
            await db.query(
                `INSERT INTO assessments (id, candidate_id, status, start_time)
                 VALUES ($1, $2, 'invited', CURRENT_TIMESTAMP)`,
                [assessmentId, candidateId]
            );

            return {
                assessmentId,
                url: `${process.env.FRONTEND_URL}/assessment.html?candidateId=${candidateId}&assessmentId=${assessmentId}`
            };
        } catch (error) {
            console.error('Generate assessment link error:', error);
            throw error;
        }
    }

    generateAssessmentEmailTemplate(candidate, recruiter, assessmentUrl, options = {}) {
        const firstName = candidate.first_name || 'there';
        const recruiterName = `${recruiter.first_name || ''} ${recruiter.last_name || ''}`.trim() || 'Northwestern Mutual Recruiting Team';

        const subject = options.customSubject || `Your Northwestern Mutual Assessment - ${firstName}`;

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Assessment Invitation</title>
            <style>
                body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
                .content { background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                .cta-button { display: inline-block; background: #16a34a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; text-align: center; }
                .cta-button:hover { background: #15803d; }
                .details { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                .highlight { color: #1e3a8a; font-weight: bold; }
                ul { padding-left: 20px; }
                li { margin: 8px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">Northwestern Mutual</div>
                    <div>Behavioral Assessment Invitation</div>
                </div>

                <div class="content">
                    <p>Dear ${firstName},</p>

                    <p>Thank you for your interest in opportunities with <span class="highlight">Northwestern Mutual</span>. We're excited to learn more about your background and working style.</p>

                    <p>As the next step in our process, we'd like to invite you to complete our <span class="highlight">Behavioral Assessment</span>. This assessment helps us understand how you approach challenges, make decisions, and work with others.</p>

                    <div class="details">
                        <h3>Assessment Overview:</h3>
                        <ul>
                            <li><strong>Time:</strong> Approximately 20 minutes</li>
                            <li><strong>Format:</strong> 27 scenario-based questions</li>
                            <li><strong>Confidentiality:</strong> Your responses are secure and confidential</li>
                            <li><strong>Purpose:</strong> Understanding your natural working style</li>
                        </ul>
                    </div>

                    <p style="text-align: center;">
                        <a href="${assessmentUrl}" class="cta-button">Begin Assessment</a>
                    </p>

                    <p><strong>Important Notes:</strong></p>
                    <ul>
                        <li>Please complete the assessment within <span class="highlight">7 days</span></li>
                        <li>Answer honestly based on your natural tendencies - there are no "right" or "wrong" answers</li>
                        <li>Ensure you have a stable internet connection</li>
                        <li>Complete in one sitting if possible</li>
                    </ul>

                    <p>If you have any questions or encounter technical issues, please don't hesitate to reach out to me directly.</p>

                    <p>We appreciate your time and look forward to learning more about you!</p>

                    <p>Best regards,<br>
                    <strong>${recruiterName}</strong><br>
                    Northwestern Mutual Recruiting<br>
                    ${recruiter.email || 'recruiting@northwestern.com'}</p>
                </div>

                <div class="footer">
                    <p>Northwestern Mutual | Behavioral Assessment System</p>
                    <p>This assessment link is unique to you and expires in 7 days.</p>
                </div>
            </div>
        </body>
        </html>`;

        return { subject, html };
    }

    async getInvitationStatus(invitationId) {
        const result = await db.query(`
            SELECT ai.*, c.first_name, c.last_name, c.email,
                   a.status as assessment_status, a.completion_percentage
            FROM assessment_invitations ai
            JOIN candidates c ON ai.candidate_id = c.id
            LEFT JOIN assessments a ON ai.assessment_id = a.id
            WHERE ai.id = $1
        `, [invitationId]);

        return result.rows[0] || null;
    }

    async getRecruiterInvitations(recruiterId, limit = 50) {
        const result = await db.query(`
            SELECT ai.*, c.first_name, c.last_name, c.email,
                   a.status as assessment_status, a.completion_percentage, a.end_time
            FROM assessment_invitations ai
            JOIN candidates c ON ai.candidate_id = c.id
            LEFT JOIN assessments a ON ai.assessment_id = a.id
            WHERE ai.recruiter_id = $1
            ORDER BY ai.invited_at DESC
            LIMIT $2
        `, [recruiterId, limit]);

        return result.rows;
    }

    async resendInvitation(invitationId, recruiterId) {
        const invitation = await this.getInvitationStatus(invitationId);

        if (!invitation || invitation.recruiter_id !== recruiterId) {
            throw new Error('Invitation not found or access denied');
        }

        // Update expiry and resend
        await db.query(`
            UPDATE assessment_invitations
            SET expires_at = NOW() + INTERVAL '7 days', resent_count = resent_count + 1
            WHERE id = $1
        `, [invitationId]);

        return await this.sendAssessmentInvitation(
            invitation.candidate_id,
            recruiterId,
            { customSubject: `Reminder: Your Northwestern Mutual Assessment - ${invitation.first_name}` }
        );
    }
}

module.exports = AssessmentInvitationService;