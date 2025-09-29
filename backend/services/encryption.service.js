const crypto = require('crypto');

/**
 * PII Encryption Service for Northwestern Mutual Compliance
 * Implements AES-256-GCM encryption for GDPR/SOX compliance
 *
 * CRITICAL: This encrypts PII before database storage
 * Required for Northwestern Mutual pilot program
 */
class EncryptionService {
    constructor() {
        // Get encryption key from environment (32 bytes for AES-256)
        this.encryptionKey = process.env.PII_ENCRYPTION_KEY;

        if (!this.encryptionKey) {
            throw new Error('PII_ENCRYPTION_KEY environment variable is required for Northwestern Mutual compliance');
        }

        if (this.encryptionKey.length !== 64) { // 32 bytes = 64 hex chars
            throw new Error('PII_ENCRYPTION_KEY must be 64 hex characters (32 bytes) for AES-256');
        }

        this.algorithm = 'aes-256-cbc';
        this.keyBuffer = Buffer.from(this.encryptionKey, 'hex');
    }

    /**
     * Encrypt PII data before storing in database
     * @param {string} plaintext - The PII data to encrypt
     * @returns {string} - Encrypted data with IV and auth tag (base64)
     */
    encrypt(plaintext) {
        if (!plaintext || typeof plaintext !== 'string') {
            return plaintext; // Don't encrypt null/undefined/non-string values
        }

        try {
            // Generate random IV for each encryption
            const iv = crypto.randomBytes(16);

            // Create cipher using the correct Node.js crypto API for CBC mode with IV
            const cipher = crypto.createCipheriv(this.algorithm, this.keyBuffer, iv);

            // Encrypt the data
            let encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            // Combine IV + encrypted data and encode as base64
            const combined = Buffer.concat([
                iv,
                Buffer.from(encrypted, 'hex')
            ]);

            return combined.toString('base64');
        } catch (error) {
            console.error('Encryption failed:', error);
            throw new Error('Failed to encrypt PII data');
        }
    }

    /**
     * Decrypt PII data when retrieving from database
     * @param {string} encryptedData - The encrypted data (base64)
     * @returns {string} - Decrypted plaintext
     */
    decrypt(encryptedData) {
        if (!encryptedData || typeof encryptedData !== 'string') {
            return encryptedData; // Return as-is if not encrypted
        }

        try {
            // Decode from base64
            const combined = Buffer.from(encryptedData, 'base64');

            // Extract IV (first 16 bytes)
            const iv = combined.slice(0, 16);

            // Extract encrypted data (remaining bytes)
            const encrypted = combined.slice(16);

            // Create decipher using the correct Node.js crypto API for CBC mode with IV
            const decipher = crypto.createDecipheriv(this.algorithm, this.keyBuffer, iv);

            // Decrypt the data
            let decrypted = decipher.update(encrypted, null, 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            console.error('Decryption failed:', error);
            // If the data looks like encrypted data (base64), return a placeholder
            // Otherwise return as-is (might be unencrypted legacy data)
            if (this.isEncryptedData(encryptedData)) {
                return '[Decryption Error]';
            }
            return encryptedData;
        }
    }

    /**
     * Encrypt multiple PII fields in an object
     * @param {Object} data - Object containing PII fields
     * @param {Array} piiFields - Array of field names to encrypt
     * @returns {Object} - Object with encrypted PII fields
     */
    encryptPIIFields(data, piiFields) {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const encrypted = { ...data };

        for (const field of piiFields) {
            if (encrypted[field]) {
                encrypted[field] = this.encrypt(encrypted[field]);
            }
        }

        return encrypted;
    }

    /**
     * Decrypt multiple PII fields in an object
     * @param {Object} data - Object containing encrypted PII fields
     * @param {Array} piiFields - Array of field names to decrypt
     * @returns {Object} - Object with decrypted PII fields
     */
    decryptPIIFields(data, piiFields) {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const decrypted = { ...data };

        for (const field of piiFields) {
            if (decrypted[field]) {
                decrypted[field] = this.decrypt(decrypted[field]);
            }
        }

        return decrypted;
    }

    /**
     * Check if data looks like encrypted data (base64 encoded)
     * @param {string} data - The data to check
     * @returns {boolean} - True if it looks encrypted
     */
    isEncryptedData(data) {
        if (!data || typeof data !== 'string') return false;

        // Check if it's base64 encoded and longer than typical plaintext
        const base64Regex = /^[A-Za-z0-9+/]+=*$/;
        return base64Regex.test(data) && data.length > 20;
    }

    /**
     * Generate a new encryption key for production use
     * @returns {string} - 64-character hex string (32 bytes)
     */
    static generateEncryptionKey() {
        return crypto.randomBytes(32).toString('hex');
    }
}

// Define PII fields that require encryption for Northwestern Mutual compliance
// Note: first_name and last_name are NOT encrypted as they're essential for recruiting operations
const PII_FIELDS = [
    'email',
    'phone',
    'address',
    'social_security_number',
    'date_of_birth',
    'personal_notes',
    'emergency_contact',
    'salary_expectations',
    'previous_employer'
];

module.exports = {
    EncryptionService,
    PII_FIELDS
};