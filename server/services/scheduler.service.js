const { google } = require('googleapis');
const db = require('../db');
const sgMail = require('@sendgrid/mail');
const openAIService = require('./openai.service');

class SchedulerService {
    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
        
        // In production, load tokens from database per user
        this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    }

    async scheduleInterview(candidateId, interviewData) {
        const {
            interviewType,
            date,
            time,
            duration,
            interviewers,
            timezone = 'America/Chicago'
        } = interviewData;

        try {
            // Create calendar event
            const event = {
                summary: `Interview: ${interviewType}`,
                description: `Interview with candidate ID: ${candidateId}`,
                start: {
                    dateTime: `${date}T${time}:00`,
                    timeZone: timezone,
                },
                end: {
                    dateTime: this.addMinutes(`${date}T${time}:00`, duration),
                    timeZone: timezone,
                },
                attendees: interviewers.map(email => ({ email })),
                conferenceData: {
                    createRequest: {
                        requestId: `interview_${candidateId}_${Date.now()}`,
                        conferenceSolutionKey: { type: 'hangoutsMeet' }
                    }
                },
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'email', minutes: 24 * 60 },
                        { method: 'popup', minutes: 30 },
                    ],
                },
            };

            const response = await this.calendar.events.insert({
                calendarId: 'primary',
                resource: event,
                conferenceDataVersion: 1,
                sendNotifications: true
            });

            // Store in database
            const dbResult = await db.query(
                `INSERT INTO interview_schedules 
                (candidate_id, interview_type, scheduled_date, scheduled_time, 
                 duration_minutes, timezone, interviewers, location_type, 
                 meeting_link, calendar_event_id, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *`,
                [
                    candidateId,
                    interviewType,
                    date,
                    time,
                    duration,
                    timezone,
                    JSON.stringify(interviewers),
                    'video',
                    response.data.hangoutLink,
                    response.data.id,
                    'scheduled'
                ]
            );

            // Generate AI interview brief
            await this.generateInterviewBrief(dbResult.rows[0].id, candidateId);

            // Send confirmation emails
            await this.sendInterviewConfirmation(candidateId, dbResult.rows[0]);

            return dbResult.rows[0];
        } catch (error) {
            console.error('Scheduling error:', error);
            throw error;
        }
    }

    async generateInterviewBrief(interviewId, candidateId) {
        // Fetch candidate data
        const candidateResult = await db.query(
            `SELECT c.*, 
                    json_agg(
                        json_build_object(
                            'dimension', ds.dimension_name,
                            'score', ds.score
                        )
                    ) as assessment_scores
             FROM candidates c
             LEFT JOIN assessments a ON c.id = a.candidate_id
             LEFT JOIN dimension_scores ds ON a.id = ds.assessment_id
             WHERE c.id = $1
             GROUP BY c.id`,
            [candidateId]
        );

        if (candidateResult.rows.length === 0) return;

        const candidate = candidateResult.rows[0];

        // Generate brief content using GPT-4
        const prompt = `
        Create an interview brief for:
        Candidate: ${candidate.first_name} ${candidate.last_name}
        Assessment Scores: ${JSON.stringify(candidate.assessment_scores)}
        
        Include:
        1. 2-3 sentence candidate summary
        2. Top 3 strengths to verify
        3. 2-3 areas to probe deeper
        4. 5 suggested interview questions
        5. Any red flags or concerns
        `;

        const response = await openAIService.openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                {
                    role: 'system',
                    content: 'You are creating an interview brief for Northwestern Mutual interviewers.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 1000
        });

        const briefContent = response.choices[0].message.content;

        // Parse and structure the brief
        const structuredBrief = this.parseBriefContent(briefContent);

        // Store in database
        await db.query(
            `INSERT INTO interview_briefs 
            (interview_id, candidate_summary, key_strengths, areas_to_probe, 
             suggested_questions, cultural_indicators, red_flags)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                interviewId,
                structuredBrief.summary,
                JSON.stringify(structuredBrief.strengths),
                JSON.stringify(structuredBrief.areasToProbe),
                JSON.stringify(structuredBrief.questions),
                JSON.stringify(structuredBrief.cultural),
                JSON.stringify(structuredBrief.redFlags)
            ]
        );
    }

    parseBriefContent(content) {
        // Simple parsing - in production, use more sophisticated NLP
        const sections = content.split('\n\n');
        
        return {
            summary: sections[0] || '',
            strengths: sections[1] ? sections[1].split('\n').filter(s => s.trim()) : [],
            areasToProbe: sections[2] ? sections[2].split('\n').filter(s => s.trim()) : [],
            questions: sections[3] ? sections[3].split('\n').filter(s => s.trim()) : [],
            cultural: [],
            redFlags: sections[4] ? sections[4].split('\n').filter(s => s.trim()) : []
        };
    }

    async sendInterviewConfirmation(candidateId, interview) {
        const candidateResult = await db.query(
            'SELECT * FROM candidates WHERE id = $1',
            [candidateId]
        );

        if (candidateResult.rows.length === 0) return;

        const candidate = candidateResult.rows[0];

        const msg = {
            to: candidate.email,
            from: 'recruiting@northwesternmutual.com',
            subject: 'Interview Scheduled - Northwestern Mutual',
            html: `
                <h2>Interview Confirmed</h2>
                <p>Dear ${candidate.first_name},</p>
                <p>Your interview has been scheduled:</p>
                <ul>
                    <li><strong>Date:</strong> ${interview.scheduled_date}</li>
                    <li><strong>Time:</strong> ${interview.scheduled_time} ${interview.timezone}</li>
                    <li><strong>Duration:</strong> ${interview.duration_minutes} minutes</li>
                    <li><strong>Meeting Link:</strong> <a href="${interview.meeting_link}">Join Video Call</a></li>
                </ul>
                <p>Please join 5 minutes early to test your connection.</p>
                <p>Best regards,<br>Northwestern Mutual Recruiting Team</p>
            `
        };

        await sgMail.send(msg);
    }

    addMinutes(dateTime, minutes) {
        const date = new Date(dateTime);
        date.setMinutes(date.getMinutes() + minutes);
        return date.toISOString();
    }
}

module.exports = new SchedulerService();

