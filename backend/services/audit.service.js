const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const db = require('../config/database');

class AuditService {
    static async log(event) {
        const auditEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            userId: event.userId,
            organizationId: event.organizationId,
            action: event.action,
            resource: event.resource,
            resourceId: event.resourceId,
            changes: event.changes,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            result: event.result || 'success',
            metadata: event.metadata || {}
        };

        // Store in database
        await db.query(
            `INSERT INTO audit_logs
            (id, user_id, organization_id, action, resource, resource_id, changes, ip_address, user_agent, result, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                auditEntry.id,
                auditEntry.userId,
                auditEntry.organizationId,
                auditEntry.action,
                auditEntry.resource,
                auditEntry.resourceId,
                JSON.stringify(auditEntry.changes),
                auditEntry.ipAddress,
                auditEntry.userAgent,
                auditEntry.result,
                JSON.stringify(auditEntry.metadata)
            ]
        );

        // Also write to file for compliance
        if (process.env.AUDIT_LOG_PATH) {
            await this.writeToFile(auditEntry);
        }

        // Check for suspicious activity
        await this.checkSuspiciousActivity(auditEntry);

        return auditEntry;
    }

    static async writeToFile(entry) {
        const logPath = process.env.AUDIT_LOG_PATH;
        const date = new Date();
        const filename = `audit-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.log`;
        const filepath = path.join(logPath, filename);

        // Ensure directory exists
        await fs.mkdir(logPath, { recursive: true });

        // Encrypt log entry
        const encryptedEntry = this.encryptLogEntry(entry);

        // Append to file
        await fs.appendFile(
            filepath,
            JSON.stringify(encryptedEntry) + '\n',
            'utf8'
        );
    }

    static encryptLogEntry(entry) {
        const algorithm = 'aes-256-gcm';
        const key = Buffer.from(process.env.AUDIT_ENCRYPTION_KEY, 'hex');
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);

        const text = JSON.stringify(entry);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        return {
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            data: encrypted,
            timestamp: entry.timestamp
        };
    }

    static async checkSuspiciousActivity(entry) {
        // Check for rapid-fire actions
        const recentActions = await db.query(
            `SELECT COUNT(*) as count
            FROM audit_logs
            WHERE user_id = $1
            AND created_at > NOW() - INTERVAL '1 minute'`,
            [entry.userId]
        );

        if (recentActions.rows[0].count > 100) {
            await this.alertSecurity({
                type: 'RAPID_FIRE_ACTIONS',
                userId: entry.userId,
                count: recentActions.rows[0].count,
                action: entry.action
            });
        }

        // Check for data exfiltration attempts
        if (entry.action === 'EXPORT' && entry.metadata.recordCount > 1000) {
            await this.alertSecurity({
                type: 'LARGE_DATA_EXPORT',
                userId: entry.userId,
                recordCount: entry.metadata.recordCount
            });
        }

        // Check for failed authentication attempts
        if (entry.action === 'LOGIN' && entry.result === 'failure') {
            const failedAttempts = await db.query(
                `SELECT COUNT(*) as count
                FROM audit_logs
                WHERE action = 'LOGIN'
                AND result = 'failure'
                AND ip_address = $1
                AND created_at > NOW() - INTERVAL '15 minutes'`,
                [entry.ipAddress]
            );

            if (failedAttempts.rows[0].count > 5) {
                await this.alertSecurity({
                    type: 'BRUTE_FORCE_ATTEMPT',
                    ipAddress: entry.ipAddress,
                    attempts: failedAttempts.rows[0].count
                });
            }
        }
    }

    static async alertSecurity(alert) {
        console.error('SECURITY ALERT:', alert);

        // Store security alert
        await db.query(
            `INSERT INTO security_alerts
            (type, severity, details, resolved)
            VALUES ($1, $2, $3, false)`,
            [alert.type, 'HIGH', JSON.stringify(alert)]
        );

        // In production, would send email/SMS/Slack alert here
    }
}

module.exports = AuditService;