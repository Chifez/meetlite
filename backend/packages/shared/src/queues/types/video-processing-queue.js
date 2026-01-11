import { BaseQueue } from '../base/base-queue.js';
import { createJobOptions } from '../utils/job-helpers.js';

/**
 * Video Processing Queue
 * Extends BaseQueue with video processing-specific functionality
 * Ready for future video processing migration
 */
export class VideoProcessingQueue extends BaseQueue {
  constructor(options = {}) {
    super('video-processing', {
      db: parseInt(process.env.BULL_REDIS_DB || '2'), // Use DB 2 for video processing
      prefix: 'bull:video-processing',
      defaultJobOptions: createJobOptions({
        attempts: 2, // Fewer retries for long-running jobs
        backoff: {
          type: 'exponential',
          delay: 5000, // Longer delay for video processing
        },
        removeOnComplete: {
          age: 30 * 24 * 60 * 60, // Keep completed jobs for 30 days
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
        },
      }),
      ...options,
    });
  }

  /**
   * Add a video processing job
   * @param {string} type - Processing type (e.g., 'transcode', 'thumbnail', 'extract_audio')
   * @param {object} data - Video processing data
   * @param {object} options - Job options
   * @returns {Promise<Job>}
   */
  async addVideoJob(type, data, options = {}) {
    return await this.addJob(type, data, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      jobId: options.jobId || `video-${type}-${data.recordingId || Date.now()}`,
      ...options,
    });
  }

  /**
   * Cancel a video processing job
   * @param {string} jobId - Job ID
   * @returns {Promise<boolean>}
   */
  async cancelVideoJob(jobId) {
    return await this.cancelJob(jobId);
  }
}
