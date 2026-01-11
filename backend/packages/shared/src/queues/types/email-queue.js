import { BaseQueue } from '../base/base-queue.js';
import { createJobOptions } from '../utils/job-helpers.js';

/**
 * Email Queue
 * Extends BaseQueue with email-specific functionality
 * Ready for future email migration
 */
export class EmailQueue extends BaseQueue {
  constructor(options = {}) {
    super('emails', {
      db: parseInt(process.env.BULL_REDIS_DB || '1'), // Use DB 1 for emails
      prefix: 'bull:emails',
      defaultJobOptions: createJobOptions({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 7 * 24 * 60 * 60, // Keep completed jobs for 7 days
          count: 5000,
        },
        removeOnFail: {
          age: 30 * 24 * 60 * 60, // Keep failed jobs for 30 days
        },
      }),
      ...options,
    });
  }

  /**
   * Add an email job
   * @param {string} type - Email type (e.g., 'welcome', 'password_reset', 'meeting_invite')
   * @param {object} data - Email data
   * @param {object} options - Job options
   * @returns {Promise<Job>}
   */
  async addEmailJob(type, data, options = {}) {
    return await this.addJob(type, data, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      jobId: options.jobId || `email-${type}-${data.id || Date.now()}`,
      ...options,
    });
  }

  /**
   * Cancel an email job
   * @param {string} jobId - Job ID
   * @returns {Promise<boolean>}
   */
  async cancelEmailJob(jobId) {
    return await this.cancelJob(jobId);
  }
}
