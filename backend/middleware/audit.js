const auditLogger = require('../services/auditLogger.service');

// Audit middleware for Express routes
const auditMiddleware = (options = {}) => {
    const {
        eventType = 'API_REQUEST',
        eventCategory = 'GENERAL',
        requireAuth = false,
        trackSensitiveData = false,
        riskLevel = 'LOW'
    } = options;

    return async (req, res, next) => {
        const startTime = Date.now();

        // Capture request details
        const requestDetails = {
            method: req.method,
            url: req.originalUrl,
            query: req.query,
            headers: {
                userAgent: req.get('User-Agent'),
                contentType: req.get('Content-Type'),
                authorization: req.get('Authorization') ? '[REDACTED]' : undefined
            },
            body: trackSensitiveData ? req.body : sanitizeBody(req.body)
        };

        // Extract user information (if authenticated)
        const userId = req.user?.id || req.user?.user_id;
        const userEmail = req.user?.email;
        const sessionId = req.sessionID || req.headers['x-session-id'];
        const ipAddress = req.ip || req.connection.remoteAddress;

        // Store original response methods
        const originalSend = res.send;
        const originalJson = res.json;
        const originalStatus = res.status;

        let responseData = null;
        let statusCode = 200;

        // Override response methods to capture response
        res.send = function(body) {
            responseData = trackSensitiveData ? body : sanitizeResponseBody(body);
            return originalSend.call(this, body);
        };

        res.json = function(obj) {
            responseData = trackSensitiveData ? obj : sanitizeResponseBody(obj);
            return originalJson.call(this, obj);
        };

        res.status = function(code) {
            statusCode = code;
            return originalStatus.call(this, code);
        };

        // Log request start for high-risk operations
        if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
            await auditLogger.logEvent({
                eventType: `${eventType}_START`,
                eventCategory,
                userId,
                userEmail,
                ipAddress,
                userAgent: req.get('User-Agent'),
                sessionId,
                action: `${req.method} ${req.route?.path || req.path}`,
                details: requestDetails,
                riskLevel,
                complianceFlags: determineComplianceFlags(req)
            });
        }

        // Handle response completion
        res.on('finish', async () => {
            const duration = Date.now() - startTime;

            try {
                await auditLogger.logEvent({
                    eventType,
                    eventCategory,
                    userId,
                    userEmail,
                    ipAddress,
                    userAgent: req.get('User-Agent'),
                    sessionId,
                    resourceType: extractResourceType(req),
                    resourceId: extractResourceId(req),
                    action: `${req.method} ${req.route?.path || req.path}`,
                    details: {
                        request: requestDetails,
                        response: {
                            statusCode,
                            data: responseData
                        }
                    },
                    requestMethod: req.method,
                    requestUrl: req.originalUrl,
                    responseStatus: statusCode,
                    durationMs: duration,
                    riskLevel: determineRiskLevel(req, statusCode, riskLevel),
                    complianceFlags: determineComplianceFlags(req)
                });
            } catch (error) {
                console.error('Audit logging failed in middleware:', error);
            }
        });

        next();
    };
};

// Specific audit middleware for authentication events
const auditAuth = async (req, res, next) => {
    const originalSend = res.send;
    const originalJson = res.json;

    let responseBody = null;
    let statusCode = 200;

    res.send = function(body) {
        responseBody = body;
        return originalSend.call(this, body);
    };

    res.json = function(obj) {
        responseBody = obj;
        return originalJson.call(this, obj);
    };

    res.on('finish', async () => {
        const success = res.statusCode >= 200 && res.statusCode < 300;
        const userEmail = req.body?.email || req.user?.email;
        const userId = success ? (req.user?.id || req.user?.user_id) : null;

        await auditLogger.logAuthentication(
            userId,
            userEmail,
            req.ip,
            req.get('User-Agent'),
            req.path.includes('login') ? 'LOGIN' :
            req.path.includes('logout') ? 'LOGOUT' :
            req.path.includes('refresh') ? 'TOKEN_REFRESH' : 'AUTH_ACTION',
            success,
            {
                endpoint: req.originalUrl,
                method: req.method,
                statusCode: res.statusCode,
                userAgent: req.get('User-Agent')
            }
        );
    });

    next();
};

// Audit middleware for data operations
const auditDataAccess = (tableName, accessType = 'READ') => {
    return async (req, res, next) => {
        const userId = req.user?.id || req.user?.user_id;
        const userEmail = req.user?.email;
        const sessionId = req.sessionID || req.headers['x-session-id'];
        const resourceId = req.params.id || req.params.candidateId || req.params.assessmentId;

        // Determine sensitive fields based on request/response
        const sensitiveFields = extractSensitiveFields(req.body, tableName);

        try {
            await auditLogger.logDataAccess(
                userId,
                userEmail,
                tableName,
                resourceId,
                accessType,
                sensitiveFields,
                sessionId
            );
        } catch (error) {
            console.error('Data access audit logging failed:', error);
        }

        next();
    };
};

// Audit middleware for candidate operations
const auditCandidateAction = (action) => {
    return async (req, res, next) => {
        const userId = req.user?.id || req.user?.user_id;
        const userEmail = req.user?.email;
        const sessionId = req.sessionID || req.headers['x-session-id'];
        const candidateId = req.params.id || req.params.candidateId;

        // Store original data for before/after comparison
        req.auditBefore = null;
        req.auditAction = action;

        // For UPDATE operations, fetch current data
        if (action === 'UPDATE' && candidateId) {
            try {
                // This would need to be adapted based on your data access layer
                // req.auditBefore = await getCandidateById(candidateId);
            } catch (error) {
                console.error('Failed to fetch before data for audit:', error);
            }
        }

        const originalSend = res.send;
        const originalJson = res.json;

        res.send = function(body) {
            logCandidateAction(body);
            return originalSend.call(this, body);
        };

        res.json = function(obj) {
            logCandidateAction(obj);
            return originalJson.call(this, obj);
        };

        const logCandidateAction = async (responseData) => {
            try {
                await auditLogger.logCandidateAction(
                    userId,
                    userEmail,
                    candidateId,
                    action,
                    req.auditBefore,
                    responseData,
                    sessionId
                );
            } catch (error) {
                console.error('Candidate action audit logging failed:', error);
            }
        };

        next();
    };
};

// Utility functions
function sanitizeBody(body) {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'ssn', 'social'];

    Object.keys(sanitized).forEach(key => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            sanitized[key] = '[REDACTED]';
        }
    });

    return sanitized;
}

function sanitizeResponseBody(body) {
    if (typeof body === 'string') {
        try {
            const parsed = JSON.parse(body);
            return sanitizeBody(parsed);
        } catch {
            return '[RESPONSE_BODY]';
        }
    }
    return sanitizeBody(body);
}

function extractResourceType(req) {
    const path = req.route?.path || req.path;
    if (path.includes('/candidates')) return 'candidate';
    if (path.includes('/assessments')) return 'assessment';
    if (path.includes('/users')) return 'user';
    if (path.includes('/sourcing')) return 'sourcing';
    if (path.includes('/outreach')) return 'outreach';
    return 'api';
}

function extractResourceId(req) {
    // Safely extract resource ID with null checks for enterprise compliance
    const params = req.params || {};
    const body = req.body || {};

    return params.id ||
           params.candidateId ||
           params.assessmentId ||
           params.userId ||
           body.id ||
           null;
}

function determineRiskLevel(req, statusCode, defaultRisk) {
    // Increase risk level for failed operations
    if (statusCode >= 400) {
        return defaultRisk === 'LOW' ? 'MEDIUM' : 'HIGH';
    }

    // High risk operations
    if (req.method === 'DELETE' ||
        req.path.includes('/admin') ||
        req.path.includes('/export')) {
        return 'HIGH';
    }

    // Medium risk operations
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        return 'MEDIUM';
    }

    return defaultRisk;
}

function determineComplianceFlags(req) {
    const flags = [];

    // All candidate data operations require SOX compliance
    if (req.path.includes('/candidates') || req.path.includes('/assessments')) {
        flags.push('SOX', 'PRIVACY');
    }

    // Authentication operations
    if (req.path.includes('/auth')) {
        flags.push('SECURITY', 'SOX');
    }

    // Admin operations
    if (req.path.includes('/admin')) {
        flags.push('SOX', 'ADMIN');
    }

    // Export operations
    if (req.path.includes('/export')) {
        flags.push('SOX', 'DATA_EXPORT', 'PRIVACY');
    }

    return flags;
}

function extractSensitiveFields(data, tableName) {
    if (!data || typeof data !== 'object') return [];

    const sensitiveFieldsByTable = {
        candidates: ['email', 'phone', 'address', 'ssn', 'salary', 'personal_notes'],
        users: ['email', 'password', 'phone'],
        assessments: ['personal_notes', 'sensitive_responses']
    };

    const sensitiveFields = sensitiveFieldsByTable[tableName] || [];
    return Object.keys(data).filter(key =>
        sensitiveFields.some(field => key.toLowerCase().includes(field))
    );
}

module.exports = {
    auditMiddleware,
    auditAuth,
    auditDataAccess,
    auditCandidateAction
};