/**
 * Cloudflare R2 Storage Service
 *
 * This service handles file uploads, downloads, and management using Cloudflare R2.
 * R2 is Cloudflare's object storage service that's S3-compatible and cost-effective.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import {
  getVideoMetadata,
  generateThumbnail,
  assessVideoQuality,
  checkFFmpegAvailability,
  extractAudioFromVideo as extractAudio,
} from './videoProcessingService.js';

// Cloudflare R2 Configuration
const R2_CONFIG = {
  accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
  accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || 'minimeet-recordings',
  region: 'auto', // Cloudflare R2 uses 'auto' region
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
};

// Initialize S3 client for R2
const r2Client = new S3Client({
  region: R2_CONFIG.region,
  endpoint: R2_CONFIG.endpoint,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
});

/**
 * Check if R2 is properly configured
 * @returns {boolean} Configuration status
 */
export const checkR2Config = () => {
  return !!(
    R2_CONFIG.accountId &&
    R2_CONFIG.accessKeyId &&
    R2_CONFIG.secretAccessKey &&
    R2_CONFIG.bucketName
  );
};

/**
 * Upload a file to Cloudflare R2
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Upload result with URLs
 */
export const uploadFile = async (fileBuffer, options = {}) => {
  try {
    const {
      fileName,
      organizationId,
      recordingId,
      fileFormat,
      contentType = 'video/mp4',
      folder = 'recordings',
    } = options;

    // Generate a unique key for the file
    const timestamp = Date.now();
    const key = `${folder}/${organizationId}/${recordingId}/${timestamp}_${fileName}`;

    // Upload parameters
    const uploadParams = {
      Bucket: R2_CONFIG.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: {
        organizationId: organizationId || 'unknown',
        recordingId: recordingId || 'unknown',
        originalFormat: fileFormat || 'unknown',
        uploadedAt: new Date().toISOString(),
      },
    };

    // Upload the file
    const command = new PutObjectCommand(uploadParams);
    const result = await r2Client.send(command);

    // Generate public URL (if bucket is public) or signed URL
    const publicUrl = `https://${R2_CONFIG.bucketName}.${R2_CONFIG.accountId}.r2.cloudflarestorage.com/${key}`;

    let videoMetadata = null;
    let thumbnailBuffer = null;
    let thumbnailUrl = `https://via.placeholder.com/320x180/2563eb/ffffff?text=Video+Thumbnail`;

    // Process video metadata and generate thumbnail if it's a video file
    if (contentType.startsWith('video/')) {
      try {
        // Check if FFmpeg is available
        const ffmpegAvailable = await checkFFmpegAvailability();

        if (ffmpegAvailable) {
          console.log('Processing video with FFmpeg...');

          // Get video metadata
          videoMetadata = await getVideoMetadata(fileBuffer);
          console.log('Video metadata:', videoMetadata);

          // Generate thumbnail
          thumbnailBuffer = await generateThumbnail(fileBuffer, {
            timeOffset: '00:00:01',
            width: 320,
            height: 180,
            quality: 2,
          });

          // Upload thumbnail to R2
          if (thumbnailBuffer) {
            const thumbnailKey = `${folder}/${organizationId}/thumbnails/${recordingId}_thumb.jpg`;
            const thumbnailCommand = new PutObjectCommand({
              Bucket: R2_CONFIG.bucketName,
              Key: thumbnailKey,
              Body: thumbnailBuffer,
              ContentType: 'image/jpeg',
              Metadata: {
                originalFile: key,
                generatedAt: new Date().toISOString(),
              },
            });

            await r2Client.send(thumbnailCommand);
            thumbnailUrl = `https://${R2_CONFIG.bucketName}.${R2_CONFIG.accountId}.r2.cloudflarestorage.com/${thumbnailKey}`;
            console.log('Thumbnail uploaded:', thumbnailUrl);
          }
        } else {
          console.warn(
            'FFmpeg not available, using fallback duration estimation'
          );
          // Fallback to file size estimation
          const fileSizeMB = fileBuffer.length / (1024 * 1024);
          videoMetadata = {
            duration: Math.max(1, Math.round(fileSizeMB * 10)),
            quality: 'unknown',
          };
        }
      } catch (error) {
        console.error('Video processing failed:', error);
        // Fallback to file size estimation
        const fileSizeMB = fileBuffer.length / (1024 * 1024);
        videoMetadata = {
          duration: Math.max(1, Math.round(fileSizeMB * 10)),
          quality: 'unknown',
        };
      }
    }

    return {
      success: true,
      key: key,
      publicUrl: publicUrl,
      downloadUrl: publicUrl, // For now, using public URL
      streamingUrl: publicUrl,
      thumbnailUrl: thumbnailUrl,
      fileSize: fileBuffer.length,
      contentType: contentType,
      duration: videoMetadata?.duration || 0,
      quality: videoMetadata ? assessVideoQuality(videoMetadata) : 'unknown',
      metadata: videoMetadata,
      uploadedAt: new Date().toISOString(),
      etag: result.ETag,
    };
  } catch (error) {
    console.error('R2 upload error:', error);
    throw new Error(`Failed to upload file to R2: ${error.message}`);
  }
};

/**
 * Upload a video file with optimized settings
 * @param {Buffer} fileBuffer - The video file buffer
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Upload result
 */
export const uploadVideoFile = async (fileBuffer, options = {}) => {
  try {
    const {
      fileName,
      organizationId,
      recordingId,
      fileFormat = 'mp4',
      quality = 'auto',
    } = options;

    const contentType = `video/${fileFormat}`;

    return await uploadFile(fileBuffer, {
      fileName,
      organizationId,
      recordingId,
      fileFormat,
      contentType,
      folder: 'recordings',
    });
  } catch (error) {
    console.error('R2 video upload error:', error);
    throw error;
  }
};

/**
 * Generate a signed URL for secure file access
 * @param {string} key - The file key in R2
 * @param {Object} options - URL options
 * @returns {Promise<string>} Signed URL
 */
export const generateSignedUrl = async (key, options = {}) => {
  try {
    const {
      expiresIn = 3600, // 1 hour default
      operation = 'getObject',
    } = options;

    const command = new GetObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
    });

    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error('R2 signed URL generation error:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

/**
 * Download a file from R2
 * @param {string} key - The file key
 * @returns {Promise<Buffer>} File buffer
 */
export const downloadFile = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
    });

    const result = await r2Client.send(command);

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of result.Body) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error('R2 download error:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
};

/**
 * Delete a file from R2
 * @param {string} key - The file key to delete
 * @returns {Promise<Object>} Deletion result
 */
export const deleteFile = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
    });

    await r2Client.send(command);

    return {
      success: true,
      message: 'File deleted successfully',
      key: key,
      deletedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('R2 delete error:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * List files in a folder
 * @param {string} prefix - Folder prefix
 * @param {Object} options - List options
 * @returns {Promise<Array>} List of files
 */
export const listFiles = async (prefix = '', options = {}) => {
  try {
    const { maxKeys = 1000, continuationToken } = options;

    const command = new ListObjectsV2Command({
      Bucket: R2_CONFIG.bucketName,
      Prefix: prefix,
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
    });

    const result = await r2Client.send(command);

    return {
      files: result.Contents || [],
      isTruncated: result.IsTruncated || false,
      nextContinuationToken: result.NextContinuationToken,
      count: result.KeyCount || 0,
    };
  } catch (error) {
    console.error('R2 list files error:', error);
    throw new Error(`Failed to list files: ${error.message}`);
  }
};

/**
 * Get file metadata
 * @param {string} key - The file key
 * @returns {Promise<Object>} File metadata
 */
export const getFileMetadata = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
    });

    const result = await r2Client.send(command);

    return {
      key: key,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
      lastModified: result.LastModified,
      etag: result.ETag,
      metadata: result.Metadata || {},
    };
  } catch (error) {
    console.error('R2 get metadata error:', error);
    throw new Error(`Failed to get file metadata: ${error.message}`);
  }
};

/**
 * Generate thumbnail for video (placeholder - would need video processing service)
 * @param {string} key - The video file key
 * @returns {Promise<Object>} Thumbnail result
 */
export const generateVideoThumbnail = async (key) => {
  // This would require a video processing service like FFmpeg
  // For now, return a placeholder
  return {
    success: false,
    message:
      'Thumbnail generation not implemented - requires video processing service',
    key: key,
  };
};

/**
 * Extract audio from video (placeholder - would need video processing service)
 * @param {string} key - The video file key
 * @returns {Promise<Object>} Audio extraction result
 */
export const extractAudioFromVideo = async (key) => {
  try {
    // Download the video file from R2
    const downloadCommand = new GetObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
    });

    const response = await r2Client.send(downloadCommand);
    const videoBuffer = await streamToBuffer(response.Body);

    // Extract audio using FFmpeg
    const audioBuffer = await extractAudio(videoBuffer, {
      bitrate: '128k',
      sampleRate: '44100',
    });

    // Upload audio to R2
    const audioKey = key.replace(/\.(mp4|avi|mov|mkv)$/i, '_audio.mp3');
    const uploadCommand = new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: audioKey,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
      Metadata: {
        originalVideo: key,
        extractedAt: new Date().toISOString(),
      },
    });

    await r2Client.send(uploadCommand);

    const audioUrl = `https://${R2_CONFIG.bucketName}.${R2_CONFIG.accountId}.r2.cloudflarestorage.com/${audioKey}`;

    return {
      success: true,
      audioUrl: audioUrl,
      key: audioKey,
      fileSize: audioBuffer.length,
      message: 'Audio extracted successfully',
    };
  } catch (error) {
    console.error('Audio extraction failed:', error);
    return {
      success: false,
      message: `Audio extraction failed: ${error.message}`,
      key: key,
    };
  }
};

/**
 * Get upload progress (placeholder - R2 doesn't provide real-time progress)
 * @param {string} uploadId - The upload ID
 * @returns {Promise<Object>} Upload progress
 */
export const getUploadProgress = async (uploadId) => {
  // R2 doesn't provide real-time upload progress
  // This would need to be implemented with custom tracking
  return {
    uploadId,
    progress: 100,
    status: 'completed',
    message: 'Upload progress tracking not available with R2',
  };
};

export default {
  checkR2Config,
  uploadFile,
  uploadVideoFile,
  generateSignedUrl,
  downloadFile,
  deleteFile,
  listFiles,
  getFileMetadata,
  generateVideoThumbnail,
  extractAudioFromVideo,
  getUploadProgress,
};
