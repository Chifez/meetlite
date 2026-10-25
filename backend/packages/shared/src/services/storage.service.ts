import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
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

export const ALLOWED_MEDIA_CONTENT_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'audio/mp4',
  'audio/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
]);

export interface CompletedPart {
  partNumber: number;
  etag: string;
}

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
   * Get the public URL for an object (e.g. public assets, logos)
   */
  static getPublicUrl(bucket: string, key: string): string {
    const publicDomain =
      process.env.STORAGE_PUBLIC_DOMAIN ||
      process.env.CLOUDFLARE_R2_PUBLIC_URL ||
      '';
    if (publicDomain) {
      const cleanDomain = publicDomain.replace(/\/$/, '');
      return `${cleanDomain}/${key}`;
    }
    return `https://${bucket}.${STORAGE_CONFIG.accountId}.r2.cloudflarestorage.com/${key}`;
  }

  /**
   * Allocate a secure object key with strict tenant path prefixing and path-traversal sanitization.
   */
  static allocateKey(tenantId: string, recordingId: string, fileName: string): string {
    // Strip path traversal and directory separators
    const sanitizedFileName = fileName
      .replace(/[\/\\]/g, '')
      .replace(/\.\.+/g, '')
      .trim();

    const cleanTenantId = tenantId.replace(/[\/\\]/g, '').trim();
    const cleanRecordingId = recordingId.replace(/[\/\\]/g, '').trim();

    return `tenants/${cleanTenantId}/recordings/${cleanRecordingId}/${sanitizedFileName || 'recording.mp4'}`;
  }

  /**
   * Validate that a part number is within the S3/R2 specification bounds (1 to 10,000).
   */
  static validatePartNumber(partNumber: number): boolean {
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
      throw new Error(`Invalid part number: ${partNumber}. Must be an integer between 1 and 10000.`);
    }
    return true;
  }

  /**
   * Validate whether a content type is an authorized media MIME type.
   */
  static isAllowedContentType(contentType: string): boolean {
    return ALLOWED_MEDIA_CONTENT_TYPES.has(contentType.toLowerCase().trim());
  }

  /**
   * Generate a Presigned Upload URL for direct-to-S3 single-part uploads
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
   * Initiate a multipart upload on Cloudflare R2
   */
  static async createMultipartUpload(
    bucket: string,
    key: string,
    contentType: string,
    metadata: Record<string, string> = {}
  ): Promise<{ uploadId: string; key: string }> {
    const command = new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      Metadata: metadata,
    });

    const response = await s3Client.send(command);
    if (!response.UploadId) {
      throw new Error('Failed to initiate multipart upload: No UploadId returned by storage provider');
    }

    return {
      uploadId: response.UploadId,
      key,
    };
  }

  /**
   * Generate a presigned URL for uploading a specific part directly from the client browser
   */
  static async getUploadPartUrl(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn = 3600
  ): Promise<{ partNumber: number; uploadUrl: string; expiresIn: number }> {
    this.validatePartNumber(partNumber);

    const command = new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return {
      partNumber,
      uploadUrl,
      expiresIn,
    };
  }

  /**
   * Complete a multipart upload once all parts are transferred
   */
  static async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: CompletedPart[]
  ): Promise<{ location?: string; etag?: string }> {
    if (!parts || parts.length === 0) {
      throw new Error('Cannot complete multipart upload with an empty parts list');
    }

    const sortedParts = [...parts]
      .sort((a, b) => a.partNumber - b.partNumber)
      .map((p) => ({
        PartNumber: p.partNumber,
        ETag: p.etag.replace(/"/g, ''), // Strip quotation marks if present
      }));

    const command = new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts,
      },
    });

    const response = await s3Client.send(command);
    return {
      location: response.Location,
      etag: response.ETag,
    };
  }

  /**
   * Abort an incomplete or cancelled multipart upload
   */
  static async abortMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    });

    await s3Client.send(command);
  }

  /**
   * Generate a secure, time-bound signed URL for private playback or download
   */
  static async getSignedDownloadUrl(
    bucket: string,
    key: string,
    expiresIn = 3600
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  }

  /**
   * Delete an object from storage
   */
  static async deleteObject(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await s3Client.send(command);
  }

  /**
   * Get the private R2 origin URL (for internal service access)
   */
  static getInternalUrl(bucket: string, key: string): string {
    return `https://${bucket}.${STORAGE_CONFIG.accountId}.r2.cloudflarestorage.com/${key}`;
  }
}
