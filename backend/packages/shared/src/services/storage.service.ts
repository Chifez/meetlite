import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Cloudflare R2 / S3 Configuration
const STORAGE_CONFIG = {
  accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID || '',
  accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
};

// Singleton S3 client
export const s3Client = new S3Client({
  region: STORAGE_CONFIG.region,
  endpoint: STORAGE_CONFIG.endpoint,
  credentials: {
    accessKeyId: STORAGE_CONFIG.accessKeyId,
    secretAccessKey: STORAGE_CONFIG.secretAccessKey,
  },
});

export class StorageService {
  /**
   * Check if storage configuration is valid
   */
  static isConfigured(): boolean {
    return !!(
      STORAGE_CONFIG.accountId &&
      STORAGE_CONFIG.accessKeyId &&
      STORAGE_CONFIG.secretAccessKey
    );
  }

  /**
   * Generate a Presigned Upload URL for direct-to-S3 uploads
   * @param bucket The S3 bucket name
   * @param key The file path/key within the bucket
   * @param contentType The MIME type of the file
   * @param expiresIn Expiration time in seconds (default 3600)
   * @returns The presigned URL
   */
  static async generatePresignedUploadUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresIn = 3600
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  }

  /**
   * Get the public URL for an uploaded file
   * @param bucket The S3 bucket name
   * @param key The file key
   * @returns Public URL string
   */
  static getPublicUrl(bucket: string, key: string): string {
    return `https://${bucket}.${STORAGE_CONFIG.accountId}.r2.cloudflarestorage.com/${key}`;
  }
}
