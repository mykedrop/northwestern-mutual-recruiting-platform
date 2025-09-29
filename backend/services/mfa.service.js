const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const db = require('../config/database');

class MFAService {
    static async setupMFA(userId) {
        const secret = speakeasy.generateSecret({
            name: `NM Recruiting (${userId})`,
            issuer: 'Northwestern Mutual',
            length: 32
        });

        // Store encrypted secret
        await db.query(
            'UPDATE recruiters SET mfa_secret = $1, mfa_enabled = false WHERE id = $2',
            [this.encryptSecret(secret.base32), userId]
        );

        const qrCode = await QRCode.toDataURL(secret.otpauth_url);

        return {
            secret: secret.base32,
            qrCode,
            backupCodes: this.generateBackupCodes()
        };
    }

    static async verifyMFAToken(userId, token) {
        const result = await db.query(
            'SELECT mfa_secret, mfa_enabled FROM recruiters WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0 || !result.rows[0].mfa_secret) {
            return false;
        }

        const secret = this.decryptSecret(result.rows[0].mfa_secret);

        return speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token,
            window: 2
        });
    }

    static async enableMFA(userId) {
        await db.query(
            'UPDATE recruiters SET mfa_enabled = true WHERE id = $1',
            [userId]
        );
    }

    static generateBackupCodes(count = 10) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            codes.push(
                Math.random().toString(36).substring(2, 8).toUpperCase() +
                '-' +
                Math.random().toString(36).substring(2, 8).toUpperCase()
            );
        }
        return codes;
    }

    static encryptSecret(secret) {
        // Use PII encryption key from config
        const crypto = require('crypto');
        const algorithm = 'aes-256-gcm';
        const key = Buffer.from(process.env.PII_ENCRYPTION_KEY, 'hex');
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);

        let encrypted = cipher.update(secret, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }

    static decryptSecret(encryptedSecret) {
        const crypto = require('crypto');
        const algorithm = 'aes-256-gcm';
        const key = Buffer.from(process.env.PII_ENCRYPTION_KEY, 'hex');

        const parts = encryptedSecret.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];

        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
}

module.exports = MFAService;