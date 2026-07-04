import { Job } from 'bullmq';
import { BaseQueue } from '../base/base-queue.js';
import { createJobOptions } from '../utils/job-helpers.js';

/**
 * Notification Queue
 * Extends BaseQueue with notification-specific functionality
 */
export class NotificationQueue extends BaseQueue {
  constructor(options: Record<string, any> = {}) {
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
   * @param type - Notification type (e.g., 'meeting_reminder')
   * @param data - Notification data
   * @param options - Job options (delay, priority, etc.)
   * @returns Job details
   */
  async addNotificationJob(type: string, data: any, options: Record<string, any> = {}): Promise<Job> {
    return await this.addJob(type, data, {
      priority: options.priority || 1,
      delay: options.delay || 0,
      jobId: options.jobId || `reminder-${data.notificationId || Date.now()}`,
      ...options,
    });
  }

  /**
   * Cancel a notification job
   * @param jobId - Job ID
   * @returns True if successfully cancelled
   */
  async cancelNotificationJob(jobId: string): Promise<boolean> {
    return await this.cancelJob(jobId);
  }
}
export default NotificationQueue;
