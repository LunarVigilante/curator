import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex) {
        // In a real app, this should throw. For development, we might fallback or warn.
        // The requirement said "look for ENCRYPTION_KEY in process.env".
        throw new Error('ENCRYPTION_KEY environment variable is not set. Please provide a 32-byte hex string.');
    }

    try {
        const key = Buffer.from(keyHex, 'hex');
        if (key.length !== KEY_LENGTH) {
            throw new Error(`ENCRYPTION_KEY must be exactly ${KEY_LENGTH} bytes (64 hex characters). Got ${key.length} bytes.`);
        }
        return key;
    } catch (error) {
        throw new Error('Invalid ENCRYPTION_KEY format. Must be a hex string.');
    }
}

/**
 * Encrypts a string using AES-256-GCM.
 * Format: iv:tag:content
 */
export function encrypt(text: string): string {
    if (!text) return text;

    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypts a string encrypted with AES-256-GCM.
 * Expects format: iv:tag:content
 * If the string does not match the format, it returns the original string (handles migration)
 */
export function decrypt(encrypted: string): string {
    if (!encrypted || !encrypted.includes(':')) return encrypted;

    try {
        const [ivHex, tagHex, contentHex] = encrypted.split(':');
        if (!ivHex || !tagHex || !contentHex) return encrypted;

        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const key = getEncryptionKey();

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(contentHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption failed:', error);
        // Return original string if decryption fails (might be plain text)
        return encrypted;
    }
}
