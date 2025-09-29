const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

class AuditLogger {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'northwestern_mutual_recruiting',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || ''
        });

        this.logFilePrefix = process.env.AUDIT_LOG_PREFIX || 'audit';
        this.logDirectory = process.env.AUDIT_LOG_DIR || path.join(__dirname, '../logs/audit');
        this.maxFileSize = parseInt(process.env.AUDIT_MAX_FILE_SIZE) || 50 * 1024 * 1024; // 50MB
        this.retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS) || 2555; // 7 years for SOX

        this.initializeLogging();
    }

    async initializeLogging() {
        try {
            // Ensure audit log directory exists
            await fs.mkdir(this.logDirectory, { recursive: true });

            // Initialize audit tables if they don't exist
            await this.initializeAuditTables();

            console.log('✅ Audit logging system initialized');
        } catch (error) {
            console.error('❌ Failed to initialize audit logging:', error);
        }
    }

    async initializeAuditTables() {
        try {
            // Create audit_logs table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    event_type VARCHAR(100) NOT NULL,
                    event_category VARCHAR(50) NOT NULL,
                    user_id VARCHAR(255),
                    user_email VARCHAR(255),
                    ip_address INET,
                    user_agent TEXT,
                    session_id VARCHAR(255),
                    resource_type VARCHAR(100),
                    resource_id VARCHAR(255),
                    action VARCHAR(100) NOT NULL,
                    details JSONB,
                    request_method VARCHAR(10),
                    request_url TEXT,
                    response_status INTEGER,
                    duration_ms INTEGER,
                    before_data JSONB,
                    after_data JSONB,
                    risk_level VARCHAR(20) DEFAULT 'LOW',
                    compliance_flags TEXT[],
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Create indexes separately
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp);
                CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs (event_type);
                CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
                CREATE INDEX IF NOT EXISTS idx_audit_logs_event_category ON audit_logs (event_category);
                CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_level ON audit_logs (risk_level);
            `);

            // Create audit_sessions table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS audit_sessions (
                    id SERIAL PRIMARY KEY,
                    session_id VARCHAR(255) UNIQUE NOT NULL,
                    user_id VARCHAR(255),
                    user_email VARCHAR(255),
                    login_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    logout_timestamp TIMESTAMP WITH TIME ZONE,
                    ip_address INET,
                    user_agent TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    failed_attempts INTEGER DEFAULT 0
                );
            `);

            // Create indexes for audit_sessions
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_audit_sessions_session_id ON audit_sessions (session_id);
                CREATE INDEX IF NOT EXISTS idx_audit_sessions_user_id ON audit_sessions (user_id);
                CREATE INDEX IF NOT EXISTS idx_audit_sessions_login_timestamp ON audit_sessions (login_timestamp);
            `);

            // Create audit_data_access table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS audit_data_access (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    user_id VARCHAR(255) NOT NULL,
                    user_email VARCHAR(255),
                    table_name VARCHAR(100) NOT NULL,
                    record_id VARCHAR(255),
                    access_type VARCHAR(50) NOT NULL,
                    sensitive_fields TEXT[],
                    query_hash VARCHAR(64),
                    row_count INTEGER,
                    session_id VARCHAR(255),
                    compliance_required BOOLEAN DEFAULT FALSE
                );
            `);

            // Create indexes for audit_data_access
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_audit_data_access_timestamp ON audit_data_access (timestamp);
                CREATE INDEX IF NOT EXISTS idx_audit_data_access_user_id ON audit_data_access (user_id);
                CREATE INDEX IF NOT EXISTS idx_audit_data_access_table_name ON audit_data_access (table_name);
                CREATE INDEX IF NOT EXISTS idx_audit_data_access_access_type ON audit_data_access (access_type);
            `);

        } catch (error) {
            console.error('Error creating audit tables:', error);
            throw error;
        }
    }

    async logEvent(eventData) {
        const {
            eventType,
            eventCategory = 'GENERAL',
            userId,
            userEmail,
            ipAddress,
            userAgent,
            sessionId,
            resourceType,
            resourceId,
            action,
            details = {},
            requestMethod,
            requestUrl,
            responseStatus,
            durationMs,
            beforeData,
            afterData,
            riskLevel = 'LOW',
            complianceFlags = []
        } = eventData;

        try {
            // Database logging
            const query = `
                INSERT INTO audit_logs (
                    event_type, event_category, user_id, user_email, ip_address,
                    user_agent, session_id, resource_type, resource_id, action,
                    details, request_method, request_url, response_status, duration_ms,
                    before_data, after_data, risk_level, compliance_flags
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                RETURNING id, timestamp
            `;

            const values = [
                eventType, eventCategory, userId, userEmail, ipAddress,
                userAgent, sessionId, resourceType, resourceId, action,
                JSON.stringify(details), requestMethod, requestUrl, responseStatus, durationMs,
                beforeData ? JSON.stringify(beforeData) : null,
                afterData ? JSON.stringify(afterData) : null,
                riskLevel, complianceFlags
            ];

            const result = await this.pool.query(query, values);

            // File logging for additional redundancy
            await this.logToFile({
                id: result.rows[0].id,
                timestamp: result.rows[0].timestamp,
                ...eventData
            });

            // Alert on high-risk events
            if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
                await this.alertHighRiskEvent(eventData);
            }

            return result.rows[0];
        } catch (error) {
            console.error('Audit logging failed:', error);
            // Fallback to file logging if database fails
            await this.logToFile(eventData);
            throw error;
        }
    }

    async logToFile(eventData) {
        try {
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                ...eventData
            };

            const logLine = JSON.stringify(logEntry) + '\n';
            const logFileName = `${this.logFilePrefix}-${new Date().toISOString().split('T')[0]}.log`;
            const logFilePath = path.join(this.logDirectory, logFileName);

            await fs.appendFile(logFilePath, logLine);

            // Check and rotate log file if necessary
            await this.rotateLogFileIfNeeded(logFilePath);
        } catch (error) {
            console.error('File audit logging failed:', error);
        }
    }

    async rotateLogFileIfNeeded(filePath) {
        try {
            const stats = await fs.stat(filePath);
            if (stats.size > this.maxFileSize) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const rotatedPath = filePath.replace('.log', `-${timestamp}.log`);
                await fs.rename(filePath, rotatedPath);
            }
        } catch (error) {
            console.error('Log rotation failed:', error);
        }
    }

    async logAuthentication(userId, userEmail, ipAddress, userAgent, action, success, details = {}) {
        return this.logEvent({
            eventType: 'AUTHENTICATION',
            eventCategory: 'SECURITY',
            userId: success ? userId : null,
            userEmail,
            ipAddress,
            userAgent,
            action,
            details: {
                success,
                ...details
            },
            riskLevel: success ? 'LOW' : 'MEDIUM',
            complianceFlags: ['SOX', 'SECURITY']
        });
    }

    async logDataAccess(userId, userEmail, tableName, recordId, accessType, sensitiveFields = [], sessionId) {
        // Log to specific data access table
        const query = `
            INSERT INTO audit_data_access (
                user_id, user_email, table_name, record_id, access_type,
                sensitive_fields, session_id, compliance_required
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        const complianceRequired = this.isComplianceTable(tableName) || sensitiveFields.length > 0;
        const values = [userId, userEmail, tableName, recordId, accessType, sensitiveFields, sessionId, complianceRequired];

        await this.pool.query(query, values);

        // Also log as general audit event
        return this.logEvent({
            eventType: 'DATA_ACCESS',
            eventCategory: 'COMPLIANCE',
            userId,
            userEmail,
            sessionId,
            resourceType: tableName,
            resourceId: recordId,
            action: accessType,
            details: {
                sensitiveFields,
                complianceRequired
            },
            riskLevel: complianceRequired ? 'HIGH' : 'LOW',
            complianceFlags: complianceRequired ? ['SOX', 'DATA_PROTECTION'] : []
        });
    }

    async logCandidateAction(userId, userEmail, candidateId, action, beforeData, afterData, sessionId) {
        const sensitiveFields = this.extractSensitiveFields(beforeData, afterData);

        return this.logEvent({
            eventType: 'CANDIDATE_ACTION',
            eventCategory: 'BUSINESS',
            userId,
            userEmail,
            sessionId,
            resourceType: 'candidate',
            resourceId: candidateId,
            action,
            beforeData,
            afterData,
            details: {
                sensitiveFields,
                hasPersonalData: sensitiveFields.length > 0
            },
            riskLevel: sensitiveFields.length > 0 ? 'MEDIUM' : 'LOW',
            complianceFlags: ['SOX', 'PRIVACY']
        });
    }

    async logSystemEvent(eventType, action, details = {}, riskLevel = 'LOW') {
        return this.logEvent({
            eventType: 'SYSTEM',
            eventCategory: 'OPERATIONS',
            action,
            details,
            riskLevel,
            complianceFlags: ['OPERATIONS']
        });
    }

    async logSession(sessionId, userId, userEmail, ipAddress, userAgent, action) {
        if (action === 'LOGIN') {
            const query = `
                INSERT INTO audit_sessions (session_id, user_id, user_email, ip_address, user_agent)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (session_id) DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    user_email = EXCLUDED.user_email,
                    login_timestamp = CURRENT_TIMESTAMP,
                    is_active = TRUE
            `;
            await this.pool.query(query, [sessionId, userId, userEmail, ipAddress, userAgent]);
        } else if (action === 'LOGOUT') {
            const query = `
                UPDATE audit_sessions
                SET logout_timestamp = CURRENT_TIMESTAMP, is_active = FALSE
                WHERE session_id = $1
            `;
            await this.pool.query(query, [sessionId]);
        }

        return this.logAuthentication(userId, userEmail, ipAddress, userAgent, action, true, {
            sessionId
        });
    }

    async alertHighRiskEvent(eventData) {
        console.warn('🚨 HIGH RISK AUDIT EVENT:', {
            eventType: eventData.eventType,
            action: eventData.action,
            userId: eventData.userId,
            timestamp: new Date().toISOString()
        });

        // In production, this would send alerts to security team
        // Could integrate with PagerDuty, Slack, email notifications, etc.
    }

    isComplianceTable(tableName) {
        const complianceTables = [
            'candidates',
            'assessments',
            'assessment_responses',
            'users',
            'outreach_campaigns',
            'email_logs'
        ];
        return complianceTables.includes(tableName);
    }

    extractSensitiveFields(beforeData, afterData) {
        const sensitiveFieldNames = ['email', 'phone', 'ssn', 'address', 'salary', 'personal_notes'];
        const sensitiveFields = [];

        const checkData = (data) => {
            if (!data || typeof data !== 'object') return;

            Object.keys(data).forEach(key => {
                if (sensitiveFieldNames.some(field => key.toLowerCase().includes(field))) {
                    sensitiveFields.push(key);
                }
            });
        };

        checkData(beforeData);
        checkData(afterData);

        return [...new Set(sensitiveFields)]; // Remove duplicates
    }

    // Audit report generation for compliance
    async generateComplianceReport(startDate, endDate, reportType = 'FULL') {
        const query = `
            SELECT
                DATE_TRUNC('day', timestamp) as date,
                event_category,
                event_type,
                action,
                COUNT(*) as event_count,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(CASE WHEN risk_level IN ('HIGH', 'CRITICAL') THEN 1 END) as high_risk_events
            FROM audit_logs
            WHERE timestamp BETWEEN $1 AND $2
                AND ($3 = 'FULL' OR event_category = $3)
            GROUP BY DATE_TRUNC('day', timestamp), event_category, event_type, action
            ORDER BY date DESC, event_count DESC
        `;

        const result = await this.pool.query(query, [startDate, endDate, reportType]);
        return result.rows;
    }

    async searchAuditLogs(filters = {}, limit = 100, offset = 0) {
        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        const values = [];
        let paramCount = 0;

        if (filters.userId) {
            query += ` AND user_id = $${++paramCount}`;
            values.push(filters.userId);
        }

        if (filters.eventType) {
            query += ` AND event_type = $${++paramCount}`;
            values.push(filters.eventType);
        }

        if (filters.startDate) {
            query += ` AND timestamp >= $${++paramCount}`;
            values.push(filters.startDate);
        }

        if (filters.endDate) {
            query += ` AND timestamp <= $${++paramCount}`;
            values.push(filters.endDate);
        }

        if (filters.riskLevel) {
            query += ` AND risk_level = $${++paramCount}`;
            values.push(filters.riskLevel);
        }

        query += ` ORDER BY timestamp DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        values.push(limit, offset);

        const result = await this.pool.query(query, values);
        return result.rows;
    }

    // Cleanup old audit logs (respecting retention policy)
    async cleanupOldLogs() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

        const query = `
            DELETE FROM audit_logs
            WHERE timestamp < $1
            AND 'SOX' != ALL(compliance_flags)  -- Keep SOX-related logs longer
        `;

        const result = await this.pool.query(query, [cutoffDate]);
        console.log(`Cleaned up ${result.rowCount} old audit log entries`);

        return result.rowCount;
    }
}

module.exports = new AuditLogger();