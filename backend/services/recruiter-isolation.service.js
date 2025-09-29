/**
 * RECRUITER ISOLATION SERVICE
 * Ensures proper data isolation between recruiters while maintaining
 * shared access to unassigned candidate pools.
 *
 * Features:
 * - Multi-recruiter candidate filtering
 * - Lead assignment workflow
 * - Real-time notifications
 * - Data privacy and security
 */

const db = require('../db');

class RecruiterIsolationService {
    constructor() {
        this.io = null; // Will be set by socket service
        this.assignmentQueue = new Map();
    }

    setSocketIO(io) {
        this.io = io;
    }

    /**
     * Get candidates visible to a specific recruiter
     * Includes: assigned candidates + unassigned pool
     */
    async getCandidatesForRecruiter(recruiterId, filters = {}) {
        try {
            const baseQuery = `
                SELECT
                    c.*,
                    u.first_name as recruiter_first_name,
                    u.last_name as recruiter_last_name,
                    CASE
                        WHEN c.recruiter_id = $1 THEN 'assigned'
                        WHEN c.recruiter_id IS NULL THEN 'unassigned'
                        ELSE 'other_recruiter'
                    END as assignment_status,
                    COALESCE(
                        (SELECT AVG(ds.score)
                         FROM assessments a
                         JOIN dimension_scores ds ON a.id = ds.assessment_id
                         WHERE a.candidate_id = c.id), 0
                    ) as avg_assessment_score
                FROM candidates c
                LEFT JOIN users u ON c.recruiter_id = u.id
                WHERE (c.recruiter_id = $1 OR c.recruiter_id IS NULL)
            `;

            let query = baseQuery;
            let params = [recruiterId];
            let paramCount = 1;

            // Add filters
            if (filters.pipelineStage) {
                paramCount++;
                query += ` AND c.pipeline_stage = $${paramCount}`;
                params.push(filters.pipelineStage);
            }

            if (filters.minScore) {
                paramCount++;
                query += ` AND c.score >= $${paramCount}`;
                params.push(filters.minScore);
            }

            if (filters.location) {
                paramCount++;
                query += ` AND c.location ILIKE $${paramCount}`;
                params.push(`%${filters.location}%`);
            }

            if (filters.assessmentStatus) {
                if (filters.assessmentStatus === 'completed') {
                    query += ` AND EXISTS (
                        SELECT 1 FROM assessments a
                        WHERE a.candidate_id = c.id
                        AND a.completion_status = 'completed'
                    )`;
                } else if (filters.assessmentStatus === 'pending') {
                    query += ` AND NOT EXISTS (
                        SELECT 1 FROM assessments a
                        WHERE a.candidate_id = c.id
                        AND a.completion_status = 'completed'
                    )`;
                }
            }

            query += ` ORDER BY c.score DESC, c.created_at DESC`;

            if (filters.limit) {
                paramCount++;
                query += ` LIMIT $${paramCount}`;
                params.push(filters.limit);
            }

            const result = await db.query(query, params);

            // Add real-time assignment status
            const candidatesWithStatus = result.rows.map(candidate => ({
                ...candidate,
                canAssign: candidate.assignment_status === 'unassigned',
                canReassign: candidate.assignment_status === 'assigned' && candidate.recruiter_id === recruiterId,
                isMyCandidate: candidate.recruiter_id === recruiterId
            }));

            return {
                success: true,
                candidates: candidatesWithStatus,
                stats: {
                    total: candidatesWithStatus.length,
                    assigned: candidatesWithStatus.filter(c => c.isMyCandidate).length,
                    unassigned: candidatesWithStatus.filter(c => c.assignment_status === 'unassigned').length
                }
            };

        } catch (error) {
            console.error('Error getting recruiter candidates:', error);
            return {
                success: false,
                error: error.message,
                candidates: []
            };
        }
    }

    /**
     * Assign a candidate to a recruiter
     */
    async assignLead(candidateId, recruiterId, assignedBy = null) {
        try {
            // Check if candidate is available for assignment
            const candidateCheck = await db.query(`
                SELECT id, recruiter_id, first_name, last_name, email
                FROM candidates
                WHERE id = $1
            `, [candidateId]);

            if (candidateCheck.rows.length === 0) {
                return {
                    success: false,
                    error: 'Candidate not found'
                };
            }

            const candidate = candidateCheck.rows[0];

            if (candidate.recruiter_id && candidate.recruiter_id !== recruiterId) {
                return {
                    success: false,
                    error: 'Candidate is already assigned to another recruiter'
                };
            }

            // Assign the candidate
            await db.query(`
                UPDATE candidates
                SET recruiter_id = $1,
                    assigned_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [recruiterId, candidateId]);

            // Log the assignment
            await this.logAssignment(candidateId, recruiterId, assignedBy);

            // Send real-time notification
            if (this.io) {
                this.io.to(`recruiter-${recruiterId}`).emit('lead-assigned', {
                    candidateId,
                    candidate: {
                        name: `${candidate.first_name} ${candidate.last_name}`,
                        email: candidate.email
                    },
                    timestamp: new Date(),
                    assignedBy
                });

                // Notify dashboard of assignment
                this.io.emit('pipeline-update', {
                    type: 'lead_assigned',
                    candidateId,
                    recruiterId,
                    timestamp: new Date()
                });
            }

            return {
                success: true,
                message: 'Lead assigned successfully',
                assignment: {
                    candidateId,
                    recruiterId,
                    assignedAt: new Date()
                }
            };

        } catch (error) {
            console.error('Error assigning lead:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Reassign candidate to different recruiter
     */
    async reassignLead(candidateId, fromRecruiterId, toRecruiterId, reason = '') {
        try {
            // Verify current assignment
            const candidateCheck = await db.query(`
                SELECT id, recruiter_id, first_name, last_name
                FROM candidates
                WHERE id = $1 AND recruiter_id = $2
            `, [candidateId, fromRecruiterId]);

            if (candidateCheck.rows.length === 0) {
                return {
                    success: false,
                    error: 'Candidate not found or not assigned to specified recruiter'
                };
            }

            // Reassign
            await db.query(`
                UPDATE candidates
                SET recruiter_id = $1,
                    assigned_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [toRecruiterId, candidateId]);

            // Log reassignment
            await this.logReassignment(candidateId, fromRecruiterId, toRecruiterId, reason);

            // Send notifications
            if (this.io) {
                const candidate = candidateCheck.rows[0];

                // Notify new recruiter
                this.io.to(`recruiter-${toRecruiterId}`).emit('lead-assigned', {
                    candidateId,
                    candidate: {
                        name: `${candidate.first_name} ${candidate.last_name}`
                    },
                    timestamp: new Date(),
                    reassigned: true,
                    reason
                });

                // Notify previous recruiter
                this.io.to(`recruiter-${fromRecruiterId}`).emit('lead-reassigned', {
                    candidateId,
                    candidate: {
                        name: `${candidate.first_name} ${candidate.last_name}`
                    },
                    timestamp: new Date(),
                    reason
                });
            }

            return {
                success: true,
                message: 'Lead reassigned successfully'
            };

        } catch (error) {
            console.error('Error reassigning lead:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Unassign candidate (return to pool)
     */
    async unassignLead(candidateId, recruiterId, reason = '') {
        try {
            // Verify assignment
            const candidateCheck = await db.query(`
                SELECT id, recruiter_id, first_name, last_name
                FROM candidates
                WHERE id = $1 AND recruiter_id = $2
            `, [candidateId, recruiterId]);

            if (candidateCheck.rows.length === 0) {
                return {
                    success: false,
                    error: 'Candidate not found or not assigned to you'
                };
            }

            // Unassign
            await db.query(`
                UPDATE candidates
                SET recruiter_id = NULL,
                    assigned_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [candidateId]);

            // Log unassignment
            await this.logUnassignment(candidateId, recruiterId, reason);

            // Notify pool update
            if (this.io) {
                this.io.emit('candidate-pool-update', {
                    type: 'returned_to_pool',
                    candidateId,
                    timestamp: new Date()
                });
            }

            return {
                success: true,
                message: 'Candidate returned to unassigned pool'
            };

        } catch (error) {
            console.error('Error unassigning lead:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get assignment analytics for a recruiter
     */
    async getRecruiterAnalytics(recruiterId) {
        try {
            const analytics = await db.query(`
                SELECT
                    COUNT(*) as total_assigned,
                    COUNT(CASE WHEN c.pipeline_stage = 'new_lead' THEN 1 END) as new_leads,
                    COUNT(CASE WHEN c.pipeline_stage = 'assessment' THEN 1 END) as in_assessment,
                    COUNT(CASE WHEN c.pipeline_stage = 'interview' THEN 1 END) as in_interview,
                    COUNT(CASE WHEN c.pipeline_stage = 'offer' THEN 1 END) as offers_extended,
                    COUNT(CASE WHEN c.pipeline_stage = 'hired' THEN 1 END) as hired,
                    AVG(c.score) as avg_candidate_score,
                    COUNT(CASE WHEN c.assigned_at > NOW() - INTERVAL '7 days' THEN 1 END) as assigned_this_week
                FROM candidates c
                WHERE c.recruiter_id = $1
            `, [recruiterId]);

            const recent_activity = await db.query(`
                SELECT
                    c.first_name,
                    c.last_name,
                    c.pipeline_stage,
                    c.assigned_at,
                    c.updated_at
                FROM candidates c
                WHERE c.recruiter_id = $1
                AND c.updated_at > NOW() - INTERVAL '24 hours'
                ORDER BY c.updated_at DESC
                LIMIT 10
            `, [recruiterId]);

            return {
                success: true,
                analytics: analytics.rows[0],
                recentActivity: recent_activity.rows
            };

        } catch (error) {
            console.error('Error getting recruiter analytics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get unassigned candidate pool
     */
    async getUnassignedPool(filters = {}) {
        try {
            let query = `
                SELECT
                    c.*,
                    COALESCE(
                        (SELECT AVG(ds.score)
                         FROM assessments a
                         JOIN dimension_scores ds ON a.id = ds.assessment_id
                         WHERE a.candidate_id = c.id), 0
                    ) as avg_assessment_score
                FROM candidates c
                WHERE c.recruiter_id IS NULL
            `;

            let params = [];
            let paramCount = 0;

            if (filters.minScore) {
                paramCount++;
                query += ` AND c.score >= $${paramCount}`;
                params.push(filters.minScore);
            }

            if (filters.location) {
                paramCount++;
                query += ` AND c.location ILIKE $${paramCount}`;
                params.push(`%${filters.location}%`);
            }

            query += ` ORDER BY c.score DESC, c.created_at DESC`;

            if (filters.limit) {
                paramCount++;
                query += ` LIMIT $${paramCount}`;
                params.push(filters.limit);
            }

            const result = await db.query(query, params);

            return {
                success: true,
                candidates: result.rows,
                count: result.rows.length
            };

        } catch (error) {
            console.error('Error getting unassigned pool:', error);
            return {
                success: false,
                error: error.message,
                candidates: []
            };
        }
    }

    /**
     * Bulk assign candidates
     */
    async bulkAssignLeads(candidateIds, recruiterId, assignedBy = null) {
        try {
            const results = [];

            for (const candidateId of candidateIds) {
                const result = await this.assignLead(candidateId, recruiterId, assignedBy);
                results.push({
                    candidateId,
                    success: result.success,
                    error: result.error
                });
            }

            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            return {
                success: true,
                message: `Bulk assignment completed: ${successful} successful, ${failed} failed`,
                results,
                stats: { successful, failed, total: candidateIds.length }
            };

        } catch (error) {
            console.error('Error in bulk assignment:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Private logging methods
    async logAssignment(candidateId, recruiterId, assignedBy) {
        try {
            await db.query(`
                INSERT INTO assignment_logs (candidate_id, recruiter_id, action, assigned_by, timestamp)
                VALUES ($1, $2, 'assigned', $3, CURRENT_TIMESTAMP)
            `, [candidateId, recruiterId, assignedBy]);
        } catch (error) {
            console.error('Error logging assignment:', error);
        }
    }

    async logReassignment(candidateId, fromRecruiterId, toRecruiterId, reason) {
        try {
            await db.query(`
                INSERT INTO assignment_logs (candidate_id, recruiter_id, previous_recruiter_id, action, reason, timestamp)
                VALUES ($1, $2, $3, 'reassigned', $4, CURRENT_TIMESTAMP)
            `, [candidateId, toRecruiterId, fromRecruiterId, reason]);
        } catch (error) {
            console.error('Error logging reassignment:', error);
        }
    }

    async logUnassignment(candidateId, recruiterId, reason) {
        try {
            await db.query(`
                INSERT INTO assignment_logs (candidate_id, previous_recruiter_id, action, reason, timestamp)
                VALUES ($1, $2, 'unassigned', $3, CURRENT_TIMESTAMP)
            `, [candidateId, recruiterId, reason]);
        } catch (error) {
            console.error('Error logging unassignment:', error);
        }
    }
}

module.exports = new RecruiterIsolationService();