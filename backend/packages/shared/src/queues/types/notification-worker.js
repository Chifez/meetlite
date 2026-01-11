import { BaseWorker } from '../base/base-worker.js';
import { decryptJobData } from '../utils/encryption.js';

/**
 * Notification Worker
 * Processes notification jobs with channel routing (in_app, email, push)
 * 
 * Note: This worker requires external dependencies to be injected:
 * - Notification model (from shared models)
 * - User model (from shared models)
 * - SSE emitter (from notification-sse.service)
 * - Email service
 * - Push notification service
 * - Audit service
 */
export class NotificationWorker extends BaseWorker {
  constructor(dependencies, options = {}) {
    const {
      Notification,
      User,
      notificationEmitter,
      sendEmail,
      sendPushNotificationToUser,
      auditNotificationSent,
      auditNotificationFailed,
      emailTemplates,
    } = dependencies;

    if (!Notification || !User) {
      throw new Error('Notification and User models are required');
    }

    // Store dependencies for use in processJob
    const workerDeps = {
      Notification,
      User,
      notificationEmitter,
      sendEmail,
      sendPushNotificationToUser,
      auditNotificationSent,
      auditNotificationFailed,
      emailTemplates,
    };

    // Process job handler - will be called by BaseWorker with 'this' bound
    const processJob = async function(job) {
      // At this point, 'this' is the NotificationWorker instance
      // The dependencies are stored on 'this' after super() completes
      return await this.processNotificationJob(job);
    };

    super('notifications', processJob, {
      db: parseInt(process.env.BULL_REDIS_DB || '0'),
      prefix: 'bull:notifications',
      concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
      limiter: {
        max: parseInt(process.env.QUEUE_RATE_LIMIT || '100'),
        duration: 60000, // Per minute
      },
      ...options,
    });

    // Store dependencies on instance after super() call
    this.Notification = Notification;
    this.User = User;
    this.notificationEmitter = notificationEmitter;
    this.sendEmail = sendEmail;
    this.sendPushNotificationToUser = sendPushNotificationToUser;
    this.auditNotificationSent = auditNotificationSent;
    this.auditNotificationFailed = auditNotificationFailed;
    this.emailTemplates = emailTemplates;
  }

  /**
   * Set the SSE notification emitter
   * @param {object} emitter - SSE emitter instance
   */
  setNotificationEmitter(emitter) {
    this.notificationEmitter = emitter;
  }

  /**
   * Send in-app notification via SSE
   */
  async sendInAppNotification(userId, notification) {
    try {
      if (!this.notificationEmitter) {
        console.warn('⚠️  SSE emitter not initialized');
        return false;
      }

      this.notificationEmitter.emit('notification', {
        userId: userId.toString(),
        notification: {
          id: notification._id.toString(),
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          read: false,
          createdAt: notification.createdAt,
        },
      });

      console.log(`✅ Sent in-app notification to user ${userId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send in-app notification:`, error);
      return false;
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(jobData) {
    try {
      if (!this.sendEmail || !this.emailTemplates) {
        console.warn('⚠️  Email service or templates not configured');
        return false;
      }

      const htmlContent = this.emailTemplates.meetingReminderHtml({
        recipientName: jobData.userName,
        meetingTitle: jobData.meetingTitle,
        meetingDescription: jobData.meetingDescription,
        meetingDate: jobData.meetingTime,
        meetingTime: new Date(jobData.meetingTime).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        duration: jobData.duration,
        timezone: jobData.timezone,
        joinUrl: jobData.joinUrl,
        organizerName: jobData.organizerName,
        logoUrl: process.env.LOGO_URL,
      });

      const textContent = this.emailTemplates.meetingReminderText({
        recipientName: jobData.userName,
        meetingTitle: jobData.meetingTitle,
        meetingDescription: jobData.meetingDescription,
        meetingDate: jobData.meetingTime,
        meetingTime: new Date(jobData.meetingTime).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        duration: jobData.duration,
        timezone: jobData.timezone,
        joinUrl: jobData.joinUrl,
        organizerName: jobData.organizerName,
      });

      await this.sendEmail({
        to: jobData.userEmail,
        subject: `Meeting Reminder: ${jobData.meetingTitle}`,
        html: htmlContent,
        text: textContent,
      });

      console.log(`✅ Sent email notification to ${jobData.userEmail}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send email notification:`, error);
      return false;
    }
  }

  /**
   * Send push notification
   */
  async sendPushNotification(jobData) {
    try {
      if (!this.sendPushNotificationToUser) {
        console.warn('⚠️  Push notification service not configured');
        return false;
      }

      const payload = {
        title: 'Meeting Reminder',
        body: `Your meeting "${jobData.meetingTitle}" starts in 10 minutes`,
        icon: '/android-chrome-192x192.png',
        badge: '/android-chrome-192x192.png',
        data: {
          url: jobData.joinUrl,
          meetingId: jobData.meetingId,
          type: 'meeting-reminder',
        },
        actions: [
          {
            action: 'join',
            title: 'Join Now',
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
          },
        ],
      };

      const result = await this.sendPushNotificationToUser(jobData.userId, payload);

      if (result.success) {
        console.log(
          `✅ Sent push notification to user ${jobData.userId} (${result.sent} device(s))`
        );
        return true;
      }

      if (result.message === 'No active subscriptions') {
        console.log(
          `ℹ️  User ${jobData.userId} has no active push subscriptions`
        );
        return false;
      }

      return false;
    } catch (error) {
      console.error(`❌ Failed to send push notification:`, error.message);
      return false;
    }
  }

  /**
   * Process notification job
   */
  async processNotificationJob(job) {
    const startTime = Date.now();
    console.log(`\n⚙️  Processing notification job ${job.id}`);

    try {
      // Decrypt job data
      const jobData = decryptJobData(job.data);
      console.log(
        `🔓 Decrypted job data for notification ${jobData.notificationId}`
      );

      // Staleness check: ensure notification isn't too old
      const now = Date.now();
      const meetingTime = new Date(jobData.meetingTime).getTime();
      const timeDiff = meetingTime - now;

      // If meeting has already passed, skip notification
      if (timeDiff < 0) {
        console.log(`⏭️  Skipping notification - meeting already passed`);
        return { skipped: true, reason: 'Meeting already passed' };
      }

      // If notification is too early (more than 15 minutes before meeting), requeue
      const expectedReminderTime = meetingTime - 10 * 60 * 1000; // 10 minutes before
      if (now < expectedReminderTime - 60000) {
        // More than 1 minute early
        throw new Error('Notification processed too early');
      }

      // Get notification from database
      const notification = await this.Notification.findById(jobData.notificationId);
      if (!notification) {
        console.warn(`⚠️  Notification ${jobData.notificationId} not found`);
        return { skipped: true, reason: 'Notification not found' };
      }

      // Check if already sent or cancelled
      if (notification.status === 'sent') {
        console.log(`⏭️  Notification already sent`);
        return { skipped: true, reason: 'Already sent' };
      }

      if (notification.status === 'cancelled') {
        console.log(`⏭️  Notification cancelled`);
        return { skipped: true, reason: 'Cancelled' };
      }

      // Verify user still exists
      const user = await this.User.findById(jobData.userId);
      if (!user) {
        console.warn(`⚠️  User ${jobData.userId} not found`);
        notification.status = 'failed';
        notification.metadata = {
          ...notification.metadata,
          error: 'User not found',
        };
        await notification.save();
        return { failed: true, reason: 'User not found' };
      }

      // Send notifications through requested channels
      const sentChannels = [];
      const failedChannels = [];

      for (const channel of jobData.channels || ['in_app']) {
        try {
          let success = false;

          switch (channel) {
            case 'in_app':
              success = await this.sendInAppNotification(jobData.userId, notification);
              break;

            case 'email':
              success = await this.sendEmailNotification(jobData);
              break;

            case 'push':
              success = await this.sendPushNotification(jobData);
              break;

            default:
              console.warn(`⚠️  Unknown channel: ${channel}`);
              continue;
          }

          if (success) {
            sentChannels.push(channel);
          } else {
            failedChannels.push(channel);
          }
        } catch (channelError) {
          console.error(`❌ Failed to send via ${channel}:`, channelError);
          failedChannels.push(channel);
        }
      }

      // Update notification status
      notification.status = sentChannels.length > 0 ? 'sent' : 'failed';
      notification.sentAt = new Date();
      notification.sentChannels = sentChannels;
      notification.metadata = {
        ...notification.metadata,
        failedChannels,
        processingDuration: Date.now() - startTime,
      };
      await notification.save();

      // Audit log
      if (sentChannels.length > 0 && this.auditNotificationSent) {
        await this.auditNotificationSent(
          jobData.userId,
          jobData.notificationId,
          sentChannels
        );
      } else if (this.auditNotificationFailed) {
        await this.auditNotificationFailed(
          jobData.userId,
          jobData.notificationId,
          new Error('All channels failed')
        );
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Notification processed successfully in ${duration}ms`);
      console.log(`   Sent via: ${sentChannels.join(', ')}`);
      if (failedChannels.length > 0) {
        console.log(`   Failed: ${failedChannels.join(', ')}`);
      }

      return {
        success: true,
        sentChannels,
        failedChannels,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Notification job failed after ${duration}ms:`, error);

      // Try to update notification status
      try {
        const jobData = decryptJobData(job.data);
        const notification = await this.Notification.findById(jobData.notificationId);
        if (notification) {
          notification.status = 'failed';
          notification.metadata = {
            ...notification.metadata,
            error: error.message,
            processingDuration: duration,
          };
          await notification.save();

          if (this.auditNotificationFailed) {
            await this.auditNotificationFailed(
              jobData.userId,
              jobData.notificationId,
              error
            );
          }
        }
      } catch (updateError) {
        console.error(`❌ Failed to update notification status:`, updateError);
      }

      throw error; // Re-throw for BullMQ retry logic
    }
  }
}

