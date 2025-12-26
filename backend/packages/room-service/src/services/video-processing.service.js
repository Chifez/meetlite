import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Video Processing Service using FFmpeg directly
 * Provides functions to extract video metadata, generate thumbnails, and process videos
 */

/**
 * Get video duration and metadata using FFprobe
 * @param {Buffer|string} input - Video file buffer or file path
 * @returns {Promise<Object>} Video metadata including duration, resolution, etc.
 */
export const getVideoMetadata = async (input) => {
  return new Promise((resolve, reject) => {
    let inputPath;
    let tempFile = null;

    const cleanup = async () => {
      if (tempFile) {
        try {
          await fs.unlink(tempFile);
        } catch (error) {}
      }
    };

    const processInput = async () => {
      try {
        if (Buffer.isBuffer(input)) {
          // Create temporary file for buffer input
          tempFile = path.join(
            os.tmpdir(),
            `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`
          );
          await fs.writeFile(tempFile, input);
          inputPath = tempFile;
        } else {
          inputPath = input;
        }

        // Use ffprobe to get video metadata
        const ffprobe = spawn('ffprobe', [
          '-v',
          'quiet',
          '-print_format',
          'json',
          '-show_format',
          '-show_streams',
          inputPath,
        ]);

        let stdout = '';
        let stderr = '';

        ffprobe.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        ffprobe.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        ffprobe.on('close', async (code) => {
          await cleanup();

          if (code !== 0) {
            reject(new Error(`FFprobe failed with code ${code}: ${stderr}`));
            return;
          }

          try {
            const metadata = JSON.parse(stdout);
            const videoStream = metadata.streams.find(
              (stream) => stream.codec_type === 'video'
            );
            const audioStream = metadata.streams.find(
              (stream) => stream.codec_type === 'audio'
            );

            const duration = parseFloat(metadata.format.duration) || 0;
            const fileSize = parseInt(metadata.format.size) || 0;

            resolve({
              duration: Math.round(duration), // Duration in seconds
              fileSize: fileSize,
              format: metadata.format.format_name || 'unknown',
              bitrate: parseInt(metadata.format.bit_rate) || 0,
              video: videoStream
                ? {
                    codec: videoStream.codec_name,
                    width: videoStream.width,
                    height: videoStream.height,
                    fps: eval(videoStream.r_frame_rate) || 0,
                    bitrate: parseInt(videoStream.bit_rate) || 0,
                  }
                : null,
              audio: audioStream
                ? {
                    codec: audioStream.codec_name,
                    channels: audioStream.channels,
                    sampleRate: audioStream.sample_rate,
                    bitrate: parseInt(audioStream.bit_rate) || 0,
                  }
                : null,
            });
          } catch (parseError) {
            reject(
              new Error(`Failed to parse FFprobe output: ${parseError.message}`)
            );
          }
        });

        ffprobe.on('error', async (error) => {
          await cleanup();
          reject(new Error(`FFprobe spawn error: ${error.message}`));
        });
      } catch (error) {
        await cleanup();
        reject(error);
      }
    };

    processInput();
  });
};

/**
 * Generate video thumbnail using FFmpeg
 * @param {Buffer|string} input - Video file buffer or file path
 * @param {Object} options - Thumbnail options
 * @returns {Promise<Buffer>} Thumbnail image buffer
 */
export const generateThumbnail = async (input, options = {}) => {
  return new Promise((resolve, reject) => {
    let inputPath;
    let tempFile = null;
    let outputPath;

    const cleanup = async () => {
      try {
        if (tempFile) await fs.unlink(tempFile);
        if (outputPath) await fs.unlink(outputPath);
      } catch (error) {
        // Failed to cleanup temp files
      }
    };

    const processThumbnail = async () => {
      try {
        if (Buffer.isBuffer(input)) {
          // Create temporary file for buffer input
          tempFile = path.join(
            os.tmpdir(),
            `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`
          );
          await fs.writeFile(tempFile, input);
          inputPath = tempFile;
        } else {
          inputPath = input;
        }

        // Create output thumbnail file
        outputPath = path.join(
          os.tmpdir(),
          `thumb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
        );

        const {
          timeOffset = '00:00:02', // Default to 2 seconds
          width = 320,
          height = 180,
          quality = 2, // FFmpeg quality scale (1-31, lower is better)
        } = options;

        // Use FFmpeg to generate thumbnail
        const ffmpeg = spawn('ffmpeg', [
          '-i',
          inputPath,
          '-ss',
          timeOffset,
          '-vframes',
          '1',
          '-vf',
          `scale=${width}:${height}`,
          '-q:v',
          quality.toString(),
          '-f',
          'image2',
          outputPath,
        ]);

        let stderr = '';

        ffmpeg.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        ffmpeg.on('close', async (code) => {
          if (code !== 0) {
            await cleanup();
            reject(
              new Error(
                `FFmpeg thumbnail generation failed with code ${code}: ${stderr}`
              )
            );
            return;
          }

          try {
            const thumbnailBuffer = await fs.readFile(outputPath);
            await cleanup();
            resolve(thumbnailBuffer);
          } catch (readError) {
            await cleanup();
            reject(
              new Error(`Failed to read thumbnail file: ${readError.message}`)
            );
          }
        });

        ffmpeg.on('error', async (error) => {
          await cleanup();
          reject(new Error(`FFmpeg spawn error: ${error.message}`));
        });
      } catch (error) {
        await cleanup();
        reject(error);
      }
    };

    processThumbnail();
  });
};

/**
 * Extract audio from video using FFmpeg
 * @param {Buffer|string} input - Video file buffer or file path
 * @param {Object} options - Audio extraction options
 * @returns {Promise<Buffer>} Audio file buffer
 */
export const extractAudioFromVideo = async (input, options = {}) => {
  return new Promise((resolve, reject) => {
    let inputPath;
    let tempFile = null;
    let outputPath;

    const cleanup = async () => {
      try {
        if (tempFile) await fs.unlink(tempFile);
        if (outputPath) await fs.unlink(outputPath);
      } catch (error) {
        // Failed to cleanup temp files
      }
    };

    const processAudio = async () => {
      try {
        if (Buffer.isBuffer(input)) {
          // Create temporary file for buffer input
          tempFile = path.join(
            os.tmpdir(),
            `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`
          );
          await fs.writeFile(tempFile, input);
          inputPath = tempFile;
        } else {
          inputPath = input;
        }

        // Create output audio file
        outputPath = path.join(
          os.tmpdir(),
          `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`
        );

        const { bitrate = '128k', sampleRate = '44100' } = options;

        // Use FFmpeg to extract audio
        const ffmpeg = spawn('ffmpeg', [
          '-i',
          inputPath,
          '-vn', // No video
          '-acodec',
          'mp3',
          '-ab',
          bitrate,
          '-ar',
          sampleRate,
          '-y', // Overwrite output file
          outputPath,
        ]);

        let stderr = '';

        ffmpeg.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        ffmpeg.on('close', async (code) => {
          if (code !== 0) {
            await cleanup();
            reject(
              new Error(
                `FFmpeg audio extraction failed with code ${code}: ${stderr}`
              )
            );
            return;
          }

          try {
            const audioBuffer = await fs.readFile(outputPath);
            await cleanup();
            resolve(audioBuffer);
          } catch (readError) {
            await cleanup();
            reject(
              new Error(`Failed to read audio file: ${readError.message}`)
            );
          }
        });

        ffmpeg.on('error', async (error) => {
          await cleanup();
          reject(new Error(`FFmpeg spawn error: ${error.message}`));
        });
      } catch (error) {
        await cleanup();
        reject(error);
      }
    };

    processAudio();
  });
};

/**
 * Get video quality assessment
 * @param {Object} metadata - Video metadata from getVideoMetadata
 * @returns {string} Quality assessment (e.g., '720p', '1080p', '4K', 'SD')
 */
export const assessVideoQuality = (metadata) => {
  if (!metadata.video) return 'unknown';

  const { width, height } = metadata.video;

  if (width >= 3840 || height >= 2160) return '4K';
  if (width >= 1920 || height >= 1080) return '1080p';
  if (width >= 1280 || height >= 720) return '720p';
  if (width >= 854 || height >= 480) return '480p';
  if (width >= 640 || height >= 360) return '360p';

  return 'SD';
};

/**
 * Check if FFmpeg is available on the system
 * @returns {Promise<boolean>} True if FFmpeg is available
 */
export const checkFFmpegAvailability = async () => {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);

    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });

    ffmpeg.on('error', () => {
      resolve(false);
    });
  });
};


