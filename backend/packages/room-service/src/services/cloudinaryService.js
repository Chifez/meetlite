import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload video file to Cloudinary
 * @param {Buffer} fileBuffer - The video file buffer
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Upload result with URLs
 */
export const uploadVideoFile = async (fileBuffer, options = {}) => {
  try {
    const { fileName, organizationId, recordingId, fileFormat } = options;

    // Generate a unique public ID
    const publicId = `recordings/${organizationId}/${recordingId}/${Date.now()}_${fileName}`;

    return new Promise((resolve, reject) => {
      // Create a readable stream from buffer
      const stream = Readable.from(fileBuffer);

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: 'video',
          folder: 'minimeet/recordings',
          use_filename: true,
          unique_filename: false,
          overwrite: false,
          // Video specific options
          quality: 'auto',
          format: 'mp4', // Convert to MP4 for better compatibility
          video_codec: 'h264',
          audio_codec: 'aac',
          // Generate thumbnails
          eager: [
            {
              width: 640,
              height: 360,
              crop: 'fill',
              format: 'jpg',
              quality: 'auto',
              start_offset: '30%', // Take thumbnail at 30% of video
            },
          ],
          // Enable streaming
          streaming_profile: 'hd',
          // Add metadata
          context: {
            organization_id: organizationId,
            recording_id: recordingId,
            original_format: fileFormat,
          },
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            resolve({
              success: true,
              publicId: result.public_id,
              url: result.secure_url,
              streamingUrl: result.playback_url || result.secure_url,
              downloadUrl: result.secure_url,
              thumbnailUrl:
                result.eager?.[0]?.secure_url ||
                result.secure_url.replace(/\.[^/.]+$/, '.jpg'),
              duration: result.duration,
              fileSize: result.bytes,
              format: result.format,
              width: result.width,
              height: result.height,
              quality: `${result.height}p`,
              storagePath: result.public_id,
            });
          }
        }
      );

      // Pipe the stream to Cloudinary
      stream.pipe(uploadStream);
    });
  } catch (error) {
    console.error('Error in uploadVideoFile:', error);
    throw error;
  }
};

/**
 * Delete video file from Cloudinary
 * @param {string} publicId - The public ID of the file to delete
 * @returns {Promise<Object>} Deletion result
 */
export const deleteVideoFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'video',
    });

    return {
      success: result.result === 'ok',
      message:
        result.result === 'ok'
          ? 'File deleted successfully'
          : 'File not found or already deleted',
    };
  } catch (error) {
    console.error('Error deleting video file:', error);
    throw error;
  }
};

/**
 * Get video file info from Cloudinary
 * @param {string} publicId - The public ID of the file
 * @returns {Promise<Object>} File information
 */
export const getVideoFileInfo = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: 'video',
    });

    return {
      success: true,
      publicId: result.public_id,
      url: result.secure_url,
      duration: result.duration,
      fileSize: result.bytes,
      format: result.format,
      width: result.width,
      height: result.height,
      createdAt: result.created_at,
    };
  } catch (error) {
    console.error('Error getting video file info:', error);
    throw error;
  }
};

/**
 * Generate a signed URL for secure video access
 * @param {string} publicId - The public ID of the file
 * @param {Object} options - URL generation options
 * @returns {string} Signed URL
 */
export const generateSignedVideoUrl = (publicId, options = {}) => {
  try {
    const {
      expiration = 3600, // 1 hour default
      transformation = {},
    } = options;

    const signedUrl = cloudinary.utils.private_download_url(publicId, 'video', {
      expires_at: Math.floor(Date.now() / 1000) + expiration,
      ...transformation,
    });

    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw error;
  }
};

/**
 * Extract audio from video for transcription
 * @param {string} publicId - The public ID of the video file
 * @returns {Promise<Object>} Audio extraction result
 */
export const extractAudioFromVideo = async (publicId) => {
  try {
    const audioPublicId = `${publicId}_audio`;

    const result = await cloudinary.uploader.upload(
      cloudinary.utils.video_url(publicId, { resource_type: 'video' }),
      {
        public_id: audioPublicId,
        resource_type: 'raw',
        format: 'mp3',
        audio_codec: 'mp3',
        video_codec: 'none', // Extract audio only
      }
    );

    return {
      success: true,
      audioPublicId: result.public_id,
      audioUrl: result.secure_url,
      duration: result.duration,
      fileSize: result.bytes,
    };
  } catch (error) {
    console.error('Error extracting audio:', error);
    throw error;
  }
};

/**
 * Get video thumbnails at specific timestamps
 * @param {string} publicId - The public ID of the video file
 * @param {Array} timestamps - Array of timestamp percentages (e.g., [10, 30, 50])
 * @returns {Promise<Array>} Array of thumbnail URLs
 */
export const generateVideoThumbnails = async (
  publicId,
  timestamps = [10, 30, 50]
) => {
  try {
    const thumbnails = timestamps.map((timestamp) => {
      return cloudinary.utils.video_url(publicId, {
        resource_type: 'video',
        start_offset: `${timestamp}%`,
        width: 640,
        height: 360,
        crop: 'fill',
        format: 'jpg',
        quality: 'auto',
      });
    });

    return {
      success: true,
      thumbnails,
    };
  } catch (error) {
    console.error('Error generating thumbnails:', error);
    throw error;
  }
};

/**
 * Check if Cloudinary is properly configured
 * @returns {boolean} Configuration status
 */
export const checkCloudinaryConfig = () => {
  const config = cloudinary.config();

  return !!(config.cloud_name && config.api_key && config.api_secret);
};

/**
 * Get upload progress (for future implementation with webhooks)
 * @param {string} uploadId - The upload ID
 * @returns {Promise<Object>} Upload progress
 */
export const getUploadProgress = async (uploadId) => {
  // This would require Cloudinary webhooks implementation
  // For now, return a placeholder
  return {
    uploadId,
    progress: 100,
    status: 'completed',
  };
};

export default {
  uploadVideoFile,
  deleteVideoFile,
  getVideoFileInfo,
  generateSignedVideoUrl,
  extractAudioFromVideo,
  generateVideoThumbnails,
  checkCloudinaryConfig,
  getUploadProgress,
};
