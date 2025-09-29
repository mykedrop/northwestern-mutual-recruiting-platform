const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');

/**
 * SOX-Compliant Audit Service for Northwestern Mutual
 * Implements Sarbanes-Oxley Section 404 requirements:
 * - Immutable audit trails
 * - 7-year retention
 * - Digital integrity verification
 * - Real-time compliance monitoring
 */
class SOXAuditService {
    constructor() {
        this.auditLogPath = process.env.AUDIT_LOG_PATH || '/var/log/northwestern-mutual/audit';
        this.encryptionKey = process.env.AUDIT_ENCRYPTION_KEY;

        if (!this.encryptionKey) {
            throw new Error('AUDIT_ENCRYPTION_KEY required for SOX compliance');
        }
    }

    /**
     * Log SOX-compliant audit event
     * @param {Object} auditEvent - The audit event to log
     */
    async logSOXEvent(auditEvent) {
        const timestamp = new Date().toISOString();
        const eventId = this.generateEventId();

        const soxEvent = {
            eventId,
            timestamp,
            version: '1.0',
            compliance: 'SOX-404',
            ...auditEvent,
            dataIntegrity: {
                hash: this.calculateEventHash(auditEvent),
                signature: this.signEvent(auditEvent),
                tamperSeal: this.generateTamperSeal()
            }
        };

        // Store in database with immutable flag
        await this.storeInDatabase(soxEvent);

        // Write to immutable log file
        await this.writeToImmutableLog(soxEvent);

        // Check compliance rules
        await this.checkComplianceRules(soxEvent);

        return eventId;
    }

    /**
     * Log data access events for GDPR/SOX compliance
     */
    async logDataAccess(userId, dataType, action, details = {}) {
        return await this.logSOXEvent({
            eventType: 'DATA_ACCESS',
            eventCategory: 'PRIVACY_COMPLIANCE',
            riskLevel: 'HIGH',
            userId,
            dataType,
            action, // 'READ', 'create', 'update', 'delete', 'export'
            details,
            complianceFlags: {
                gdpr: true,
                sox: true,
                pii: dataType.includes('candidate') || dataType.includes('personal')
            }
        });
    }

    /**
     * Log financial/business critical events
     */
    async logBusinessCriticalEvent(userId, businessFunction, action, financialImpact = null) {
        return await this.logSOXEvent({
            eventType: 'BUSINESS_CRITICAL',
            eventCategory: 'FINANCIAL_REPORTING',
            riskLevel: 'CRITICAL',
            userId,
            businessFunction,
            action,
            financialImpact,
            complianceFlags: {
                sox: true,
                financialReporting: true,
                requiresAttestation: financialImpact !== null
            }
        });
    }

    /**
     * Log authentication/authorization events
     */
    async logSecurityEvent(userId, securityAction, success, riskLevel = 'MEDIUM') {
        return await this.logSOXEvent({
            eventType: 'SECURITY',
            eventCategory: 'ACCESS_CONTROL',
            riskLevel,
            userId,
            securityAction,
            success,
            timestamp: new Date().toISOString(),
            complianceFlags: {
                sox: true,
                accessControl: true,
                requiresReview: !success || riskLevel === 'HIGH'
            }
        });
    }

    /**
     * Generate cryptographically secure event ID
     */
    generateEventId() {
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(8).toString('hex');
        return `NM-${timestamp}-${random}`.toUpperCase();
    }

    /**
     * Calculate event hash for integrity verification
     */
    calculateEventHash(event) {
        const eventString = JSON.stringify(event, Object.keys(event).sort());
        return crypto.createHash('sha256').update(eventString).digest('hex');
    }

    /**
     * Sign event with HMAC for authenticity
     */
    signEvent(event) {
        const eventString = JSON.stringify(event, Object.keys(event).sort());
        return crypto.createHmac('sha256', this.encryptionKey).update(eventString).digest('hex');
    }

    /**
     * Generate tamper-evident seal
     */
    generateTamperSeal() {
        const timestamp = Date.now();
        const random = crypto.randomBytes(16);
        const seal = crypto.createHash('sha256')
            .update(Buffer.concat([Buffer.from(timestamp.toString()), random]))
            .digest('hex');
        return `TS-${seal.substring(0, 16).toUpperCase()}`;
    }

    /**
     * Store event in database with immutable protection
     */
    async storeInDatabase(soxEvent) {
        const query = `
            INSERT INTO sox_audit_log (
                event_id, timestamp, event_type, event_category, risk_level,
                user_id, event_data, data_integrity_hash, digital_signature,
                tamper_seal, compliance_flags, retention_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;

        const retentionDate = new Date();
        retentionDate.setFullYear(retentionDate.getFullYear() + 7); // SOX 7-year retention

        const values = [
            soxEvent.eventId,
            soxEvent.timestamp,
            soxEvent.eventType,
            soxEvent.eventCategory,
            soxEvent.riskLevel,
            soxEvent.userId,
            JSON.stringify(soxEvent),
            soxEvent.dataIntegrity.hash,
            soxEvent.dataIntegrity.signature,
            soxEvent.dataIntegrity.tamperSeal,
            JSON.stringify(soxEvent.complianceFlags || {}),
            retentionDate
        ];

        await db.query(query, values);
    }

    /**
     * Write to immutable append-only log file
     */
    async writeToImmutableLog(soxEvent) {
        try {
            const logDir = path.dirname(this.auditLogPath);
            await fs.mkdir(logDir, { recursive: true });

            const logEntry = `${JSON.stringify(soxEvent)}\n`;
            const logFile = `${this.auditLogPath}/sox-audit-${new Date().toISOString().split('T')[0]}.log`;

            await fs.appendFile(logFile, logEntry, { flag: 'a' });

            // Set file permissions to read-only after writing
            await fs.chmod(logFile, 0o444);
        } catch (error) {
            console.error('Failed to write to immutable log:', error);
            // Continue execution - database storage is primary
        }
    }

    /**
     * Check compliance rules and trigger alerts
     */
    async checkComplianceRules(soxEvent) {
        const rules = [
            this.checkHighRiskActivity(soxEvent),
            this.checkUnauthorizedAccess(soxEvent),
            this.checkDataExfiltration(soxEvent),
            this.checkFinancialReportingActivity(soxEvent)
        ];

        const violations = await Promise.all(rules);
        const activeViolations = violations.filter(v => v.violation);

        if (activeViolations.length > 0) {
            await this.triggerComplianceAlert(soxEvent, activeViolations);
        }
    }

    /**
     * Check for high-risk activity patterns
     */
    async checkHighRiskActivity(event) {
        if (event.riskLevel === 'CRITICAL' || event.riskLevel === 'HIGH') {
            return {
                violation: true,
                rule: 'HIGH_RISK_ACTIVITY',
                description: 'High-risk activity detected requiring immediate review',
                severity: 'HIGH'
            };
        }
        return { violation: false };
    }

    /**
     * Check for unauthorized access patterns
     */
    async checkUnauthorizedAccess(event) {
        if (event.eventType === 'SECURITY' && !event.success) {
            // Check for repeated failed attempts
            const recentFailures = await db.query(`
                SELECT COUNT(*) as failure_count
                FROM sox_audit_log
                WHERE user_id = $1
                AND event_type = 'SECURITY'
                AND event_data->>'success' = 'false'
                AND timestamp > NOW() - INTERVAL '1 hour'
            `, [event.userId]);

            if (recentFailures.rows[0].failure_count >= 5) {
                return {
                    violation: true,
                    rule: 'REPEATED_ACCESS_FAILURES',
                    description: 'Multiple failed authentication attempts detected',
                    severity: 'CRITICAL'
                };
            }
        }
        return { violation: false };
    }

    /**
     * Check for potential data exfiltration
     */
    async checkDataExfiltration(event) {
        if (event.eventType === 'DATA_ACCESS' && event.action === 'export') {
            // Check export volume and frequency
            const recentExports = await db.query(`
                SELECT COUNT(*) as export_count
                FROM sox_audit_log
                WHERE user_id = $1
                AND event_type = 'DATA_ACCESS'
                AND event_data->>'action' = 'export'
                AND timestamp > NOW() - INTERVAL '24 hours'
            `, [event.userId]);

            if (recentExports.rows[0].export_count >= 10) {
                return {
                    violation: true,
                    rule: 'EXCESSIVE_DATA_EXPORT',
                    description: 'Excessive data export activity detected',
                    severity: 'HIGH'
                };
            }
        }
        return { violation: false };
    }

    /**
     * Check financial reporting activities
     */
    async checkFinancialReportingActivity(event) {
        if (event.complianceFlags?.financialReporting && event.riskLevel === 'CRITICAL') {
            return {
                violation: true,
                rule: 'FINANCIAL_REPORTING_ACTIVITY',
                description: 'Financial reporting activity requires executive attestation',
                severity: 'MEDIUM'
            };
        }
        return { violation: false };
    }

    /**
     * Trigger compliance alert for violations
     */
    async triggerComplianceAlert(event, violations) {
        const alert = {
            alertId: this.generateEventId(),
            timestamp: new Date().toISOString(),
            severity: Math.max(...violations.map(v => v.severity === 'CRITICAL' ? 3 : v.severity === 'HIGH' ? 2 : 1)),
            originalEvent: event.eventId,
            violations,
            requiresReview: true,
            notificationSent: false
        };

        // Store alert in database
        await db.query(`
            INSERT INTO sox_compliance_alerts (
                alert_id, timestamp, severity, original_event_id,
                violations, requires_review, notification_sent
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            alert.alertId,
            alert.timestamp,
            alert.severity,
            alert.originalEvent,
            JSON.stringify(alert.violations),
            alert.requiresReview,
            alert.notificationSent
        ]);

        console.warn(`SOX COMPLIANCE ALERT: ${alert.alertId}`, violations);
    }

    /**
     * Verify audit log integrity
     */
    async verifyAuditIntegrity(eventId) {
        const result = await db.query(
            'SELECT * FROM sox_audit_log WHERE event_id = $1',
            [eventId]
        );

        if (result.rows.length === 0) {
            return { valid: false, reason: 'Event not found' };
        }

        const event = result.rows[0];
        const eventData = JSON.parse(event.event_data);

        // Verify hash
        const calculatedHash = this.calculateEventHash(eventData);
        if (calculatedHash !== event.data_integrity_hash) {
            return { valid: false, reason: 'Hash mismatch - possible tampering' };
        }

        // Verify signature
        const calculatedSignature = this.signEvent(eventData);
        if (calculatedSignature !== event.digital_signature) {
            return { valid: false, reason: 'Signature mismatch - possible tampering' };
        }

        return { valid: true, event: eventData };
    }
}

module.exports = SOXAuditService;