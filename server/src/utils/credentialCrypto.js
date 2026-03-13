const crypto = require('crypto');

const ENC_PREFIX = 'enc:v1:';

function getKey() {
    const raw = process.env.SSH_CREDENTIALS_KEY;
    if (!raw) {
        throw new Error('SSH_CREDENTIALS_KEY is not configured');
    }

    // Accept 64-hex key directly, otherwise derive stable 32-byte key from input.
    if (/^[a-fA-F0-9]{64}$/.test(raw)) {
        return Buffer.from(raw, 'hex');
    }
    return crypto.createHash('sha256').update(raw).digest();
}

function encryptSecret(plainText) {
    if (plainText === null || plainText === undefined || plainText === '') return plainText;
    const input = String(plainText);
    if (input.startsWith(ENC_PREFIX)) return input;

    const key = getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(input, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const payload = `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
    return `${ENC_PREFIX}${payload}`;
}

function decryptSecret(value) {
    if (value === null || value === undefined || value === '') return value;
    const input = String(value);
    if (!input.startsWith(ENC_PREFIX)) return input; // Backward compatibility with plaintext legacy values

    const key = getKey();
    const payload = input.slice(ENC_PREFIX.length);
    const parts = payload.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted secret format');
    }

    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
}

module.exports = { encryptSecret, decryptSecret, ENC_PREFIX };
