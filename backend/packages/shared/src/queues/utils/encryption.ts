import crypto from 'crypto';

/**
 * Encryption utilities for queue job data
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
let ENCRYPTION_KEY: Buffer | null = null;

const getEncryptionKey = (): Buffer => {
  if (!ENCRYPTION_KEY) {
    ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');

    if (ENCRYPTION_KEY.length !== 32) {
      console.error(
        'ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'
      );
      throw new Error('Invalid ENCRYPTION_KEY configuration');
    }
  }
  return ENCRYPTION_KEY;
};

export interface EncryptedJobData {
  encrypted: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypt sensitive job data before storing in Redis
 * @param data - Data to encrypt
 * @returns Encrypted data with IV and auth tag
 */
export const encryptJobData = (data: any): EncryptedJobData => {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const jsonData = JSON.stringify(data);
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  } catch (error) {
    console.error('❌ Encryption error:', error);
    throw new Error('Failed to encrypt job data');
  }
};

/**
 * Decrypt job data retrieved from Redis
 * @param encryptedData - Encrypted data with IV and auth tag
 * @returns Decrypted data
 */
export const decryptJobData = (encryptedData: any): any => {
  try {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(encryptedData.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('❌ Decryption error:', error);
    throw new Error('Failed to decrypt job data');
  }
};
