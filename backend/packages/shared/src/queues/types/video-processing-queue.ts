import { Job } from 'bullmq';
import { BaseQueue } from '../base/base-queue.js';
import { createJobOptions } from '../utils/job-helpers.js';

/**
 * Video Processing Queue
 * Extends BaseQueue with video processing-specific functionality
 */
export class VideoProcessingQueue extends BaseQueue {
  constructor(options: Record<string, any> = {}) {
    super('video-processing', {
      db: parseInt(process.env.BULL_REDIS_DB || '2'),
      prefix: 'bull:video-processing',
      defaultJobOptions: createJobOptions({
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 30 * 24 * 60 * 60,
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60,
        },
      }),
      ...options,
    });
  }

  /**
   * Add a video processing job
   * @param type - Processing type (e.g., 'transcode', 'thumbnail', 'extract_audio')
   * @param data - Video processing data
   * @param options - Job options
   * @returns Job details
   */
  async addVideoJob(type: string, data: any, options: Record<string, any> = {}): Promise<Job> {
    return await this.addJob(type, data, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      jobId: options.jobId || `video-${type}-${data.recordingId || Date.now()}`,
      ...options,
    });
  }

  /**
   * Cancel a video processing job
   * @param jobId - Job ID
   * @returns True if successfully cancelled
   */
  async cancelVideoJob(jobId: string): Promise<boolean> {
    return await this.cancelJob(jobId);
  }
}
export default VideoProcessingQueue;
