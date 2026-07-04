import { Job } from 'bullmq';
import { BaseQueue } from '../base/base-queue.js';
import { createJobOptions } from '../utils/job-helpers.js';

/**
 * Email Queue
 * Extends BaseQueue with email-specific functionality
 */
export class EmailQueue extends BaseQueue {
  constructor(options: Record<string, any> = {}) {
    super('emails', {
      db: parseInt(process.env.BULL_REDIS_DB || '1'),
      prefix: 'bull:emails',
      defaultJobOptions: createJobOptions({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 7 * 24 * 60 * 60,
          count: 5000,
        },
        removeOnFail: {
          age: 30 * 24 * 60 * 60,
        },
      }),
      ...options,
    });
  }

  /**
   * Add an email job
   * @param type - Email type (e.g., 'welcome', 'password_reset', 'meeting_invite')
   * @param data - Email data
   * @param options - Job options
   * @returns Job details
   */
  async addEmailJob(type: string, data: any, options: Record<string, any> = {}): Promise<Job> {
    return await this.addJob(type, data, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      jobId: options.jobId || `email-${type}-${data.id || Date.now()}`,
      ...options,
    });
  }

  /**
   * Cancel an email job
   * @param jobId - Job ID
   * @returns True if successfully cancelled
   */
  async cancelEmailJob(jobId: string): Promise<boolean> {
    return await this.cancelJob(jobId);
  }
}
export default EmailQueue;
