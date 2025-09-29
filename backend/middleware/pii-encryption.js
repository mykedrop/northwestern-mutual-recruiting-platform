const { EncryptionService, PII_FIELDS } = require('../services/encryption.service');

/**
 * PII Encryption Middleware for Northwestern Mutual Compliance
 * Automatically encrypts/decrypts PII data in database operations
 */

let encryptionService;

try {
    encryptionService = new EncryptionService();
} catch (error) {
    console.error('CRITICAL: PII Encryption Service failed to initialize:', error.message);
    console.error('This is required for Northwestern Mutual compliance');
    throw error;
}

/**
 * Middleware to encrypt PII data before database insertion/updates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const encryptPIIMiddleware = (req, res, next) => {
    // Check if this is a candidate-related operation
    if (req.body && (req.url.includes('/candidates') || req.url.includes('/assessment'))) {
        try {
            // Encrypt PII fields in request body
            if (req.body.candidate) {
                req.body.candidate = encryptionService.encryptPIIFields(req.body.candidate, PII_FIELDS);
            }

            // Handle direct candidate data in body
            if (req.body.first_name || req.body.last_name || req.body.email) {
                req.body = encryptionService.encryptPIIFields(req.body, PII_FIELDS);
            }

            // Handle assessment responses that might contain PII
            if (req.body.responses && Array.isArray(req.body.responses)) {
                req.body.responses = req.body.responses.map(response => {
                    if (response.value && typeof response.value === 'string') {
                        // Encrypt free-text responses that might contain PII
                        return {
                            ...response,
                            value: encryptionService.encrypt(response.value)
                        };
                    }
                    return response;
                });
            }

            console.log('PII data encrypted for Northwestern Mutual compliance');
        } catch (error) {
            console.error('PII encryption failed:', error);
            return res.status(500).json({
                error: 'Failed to secure candidate data',
                message: 'PII encryption required for Northwestern Mutual compliance'
            });
        }
    }

    next();
};

/**
 * Middleware to decrypt PII data after database retrieval
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const decryptPIIMiddleware = (req, res, next) => {
    // Override res.json to decrypt data before sending
    const originalJson = res.json;

    res.json = function(data) {
        try {
            // Decrypt candidate data
            if (data && data.candidates && Array.isArray(data.candidates)) {
                data.candidates = data.candidates.map(candidate =>
                    encryptionService.decryptPIIFields(candidate, PII_FIELDS)
                );
            }

            // Decrypt single candidate
            if (data && data.candidate) {
                data.candidate = encryptionService.decryptPIIFields(data.candidate, PII_FIELDS);
            }

            // Decrypt direct candidate object
            if (data && (data.first_name || data.last_name || data.email)) {
                data = encryptionService.decryptPIIFields(data, PII_FIELDS);
            }

            // Decrypt assessment responses
            if (data && data.responses && Array.isArray(data.responses)) {
                data.responses = data.responses.map(response => {
                    if (response.value && typeof response.value === 'string') {
                        return {
                            ...response,
                            value: encryptionService.decrypt(response.value)
                        };
                    }
                    return response;
                });
            }

            console.log('PII data decrypted for Northwestern Mutual compliance');
        } catch (error) {
            console.error('PII decryption failed:', error);
            // Continue with original data if decryption fails
        }

        return originalJson.call(this, data);
    };

    next();
};

/**
 * Direct encryption/decryption functions for database queries
 */
const encryptCandidateData = (candidateData) => {
    return encryptionService.encryptPIIFields(candidateData, PII_FIELDS);
};

const decryptCandidateData = (candidateData) => {
    return encryptionService.decryptPIIFields(candidateData, PII_FIELDS);
};

/**
 * Encrypt assessment response data
 */
const encryptAssessmentData = (assessmentData) => {
    if (assessmentData.responses && Array.isArray(assessmentData.responses)) {
        assessmentData.responses = assessmentData.responses.map(response => {
            if (response.value && typeof response.value === 'string') {
                return {
                    ...response,
                    value: encryptionService.encrypt(response.value)
                };
            }
            return response;
        });
    }
    return assessmentData;
};

/**
 * Decrypt assessment response data
 */
const decryptAssessmentData = (assessmentData) => {
    if (assessmentData.responses && Array.isArray(assessmentData.responses)) {
        assessmentData.responses = assessmentData.responses.map(response => {
            if (response.value && typeof response.value === 'string') {
                return {
                    ...response,
                    value: encryptionService.decrypt(response.value)
                };
            }
            return response;
        });
    }
    return assessmentData;
};

module.exports = {
    encryptPIIMiddleware,
    decryptPIIMiddleware,
    encryptCandidateData,
    decryptCandidateData,
    encryptAssessmentData,
    decryptAssessmentData,
    PII_FIELDS
};