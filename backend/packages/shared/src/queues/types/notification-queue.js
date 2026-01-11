import { BaseQueue } from '../base/base-queue.js';
import { createJobOptions } from '../utils/job-helpers.js';

/**
 * Notification Queue
 * Extends BaseQueue with notification-specific functionality
 */
export class NotificationQueue extends BaseQueue {
  constructor(options = {}) {
    super('notifications', {
      db: parseInt(process.env.BULL_REDIS_DB || '0'),
      prefix: 'bull:notifications',
      defaultJobOptions: createJobOptions({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 60 * 60, // Keep completed jobs for 24 hours
          count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
        },
      }),
      ...options,
    });
  }

  /**
   * Add a notification job
   * @param {string} type - Notification type (e.g., 'meeting_reminder')
   * @param {object} data - Notification data
   * @param {object} options - Job options (delay, priority, etc.)
   * @returns {Promise<Job>}
   */
  async addNotificationJob(type, data, options = {}) {
    return await this.addJob(type, data, {
      priority: options.priority || 1,
      delay: options.delay || 0,
      jobId: options.jobId || `reminder-${data.notificationId || Date.now()}`,
      ...options,
    });
  }

  /**
   * Cancel a notification job
   * @param {string} jobId - Job ID
   * @returns {Promise<boolean>}
   */
  async cancelNotificationJob(jobId) {
    return await this.cancelJob(jobId);
  }
}
