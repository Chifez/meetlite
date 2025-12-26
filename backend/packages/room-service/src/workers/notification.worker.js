import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { Notification, User } from '@minimeet/shared-models';
import { decryptJobData } from '../queues/notification.queue.js';
import {
  auditNotificationSent,
  auditNotificationFailed,
} from '../services/audit.service.js';
import { sendEmail } from '../services/email.service.js';
import { sendPushNotificationToUser } from '../services/push-notification.service.js';
import {
  meetingReminderEmailTemplate,
  meetingReminderEmailText,
} from '../templates/meeting-reminder-email.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Notification Worker
 * Processes notification jobs from the queue with security checks
 */

// Create Redis connection for worker
const connection = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.BULL_REDIS_DB || '1'),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  ...(process.env.NODE_ENV === 'production' &&
    process.env.REDIS_TLS === 'true' && {
      tls: {
        rejectUnauthorized: true,
      },
    }),
});

// WebSocket emitter (will be set when server initializes)
let notificationEmitter = null;

export const setNotificationEmitter = (emitter) => {
  notificationEmitter = emitter;
};

/**
 * Send in-app notification via SSE
 */
const sendInAppNotification = async (userId, notification) => {
  try {
    if (!notificationEmitter) {
      console.warn('⚠️  SSE emitter not initialized');
      return false;
    }

    notificationEmitter.emit('notification', {
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
};

/**
 * Send email notification
 */
const sendEmailNotification = async (jobData) => {
  try {
    const htmlContent = meetingReminderEmailTemplate({
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

    const textContent = meetingReminderEmailText({
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

    await sendEmail({
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
};

/**
 * Send push notification directly using shared database
 */
const sendPushNotification = async (jobData) => {
  try {
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

    const result = await sendPushNotificationToUser(jobData.userId, payload);

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
};

/**
 * Process notification job
 */
const processNotificationJob = async (job) => {
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
    const notification = await Notification.findById(jobData.notificationId);
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
    const user = await User.findById(jobData.userId);
    if (!user) {
      console.warn(`⚠️  User ${jobData.userId} not found`);
      notification.status = 'failed';
      notification.metadata.error = 'User not found';
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
            success = await sendInAppNotification(jobData.userId, notification);
            break;

          case 'email':
            success = await sendEmailNotification(jobData);
            break;

          case 'push':
            success = await sendPushNotification(jobData);
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
    if (sentChannels.length > 0) {
      await auditNotificationSent(
        jobData.userId,
        jobData.notificationId,
        sentChannels
      );
    } else {
      await auditNotificationFailed(
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
      const notification = await Notification.findById(jobData.notificationId);
      if (notification) {
        notification.status = 'failed';
        notification.metadata = {
          ...notification.metadata,
          error: error.message,
          processingDuration: duration,
        };
        await notification.save();

        await auditNotificationFailed(
          jobData.userId,
          jobData.notificationId,
          error
        );
      }
    } catch (updateError) {
      console.error(`❌ Failed to update notification status:`, updateError);
    }

    throw error; // Re-throw for BullMQ retry logic
  }
};

/**
 * Create and start the notification worker
 */
export const createNotificationWorker = () => {
  const worker = new Worker('notifications', processNotificationJob, {
    connection,
    prefix: 'bull:notifications',
    concurrency: 5, // Process up to 5 jobs concurrently
    limiter: {
      max: 100, // Max 100 jobs
      duration: 60000, // Per minute
    },
  });

  // Worker event listeners
  worker.on('completed', (job, result) => {
    if (result.skipped) {
      console.log(`⏭️  Job ${job.id} skipped: ${result.reason}`);
    } else if (result.success) {
      console.log(`✅ Job ${job.id} completed successfully`);
    }
  });

  worker.on('failed', (job, error) => {
    console.error(`❌ Job ${job?.id} failed:`, error.message);
  });

  worker.on('error', (error) => {
    console.error(`❌ Worker error:`, error);
  });

  worker.on('ready', () => {
    console.log(`✅ Notification worker ready and listening for jobs`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('⏹️  Shutting down notification worker...');
    await worker.close();
    await connection.quit();
  });

  return worker;
};

export default createNotificationWorker;
