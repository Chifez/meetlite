import {
  Notification,
  User,
  PushSubscription,
  NotificationQueue,
} from '@minimeet/shared';
import {
  auditNotificationScheduled,
  auditNotificationCancelled,
} from './audit.service.js';
import sanitizeHtml from 'sanitize-html';
import { body, param, validationResult } from 'express-validator';

/**
 * Notification Service
 * Handles scheduling and canceling meeting reminders with validation
 */

// Lazy-load NotificationQueue instance (created on first use)
// This ensures dotenv.config() has been called before queue instantiation
let notificationQueue = null;
const getNotificationQueue = () => {
  if (!notificationQueue) {
    notificationQueue = new NotificationQueue();
  }
  return notificationQueue;
};

const REMINDER_MINUTES = parseInt(
  process.env.NOTIFICATION_REMINDER_MINUTES || '10'
);

/**
 * Map notification type from database format to user preferences format
 * @param {string} dbType - Database notification type (e.g., 'meeting_reminder')
 * @returns {string} User preference type key (e.g., 'meetingReminders')
 */
const mapNotificationTypeToPreference = (dbType) => {
  const typeMap = {
    meeting_reminder: 'meetingReminders',
    meeting_invitation: 'meetingInvitations',
    meeting_updated: 'meetingUpdates',
    meeting_cancelled: 'meetingUpdates',
    recording_ready: 'recordingReady',
    transcript_ready: 'recordingReady',
  };
  return typeMap[dbType] || 'meetingReminders';
};

/**
 * Get user's notification channels based on preferences
 * @param {string} userId - User ID
 * @param {string} notificationType - Type of notification (e.g., 'meeting_reminder')
 * @returns {Promise<Array<string>>} Array of enabled channels
 */
const getUserNotificationChannels = async (
  userId,
  notificationType = 'meeting_reminder'
) => {
  try {
    const user = await User.findById(userId)
      .select('notificationPreferences')
      .lean();

    const prefs = user?.notificationPreferences || {};

    // If notifications disabled, return empty array
    if (prefs.enabled === false) {
      return [];
    }

    // Check if this notification type is enabled
    const preferenceKey = mapNotificationTypeToPreference(notificationType);
    const typeEnabled = prefs.types?.[preferenceKey];
    if (typeEnabled === false) {
      return [];
    }

    const channels = [];

    // In-app is default if notifications enabled
    // Always include in-app if notifications are enabled
    channels.push('in_app');

    // Email if enabled (defaults to true)
    if (prefs.channels?.email !== false) {
      channels.push('email');
    }

    // Push if enabled AND user has active subscriptions
    if (prefs.channels?.push === true) {
      const hasActiveSubscriptions = await PushSubscription.exists({
        userId,
        isActive: true,
      });

      if (hasActiveSubscriptions) {
        channels.push('push');
      }
    }

    return channels;
  } catch (error) {
    console.error(
      `❌ Failed to get user notification channels for ${userId}:`,
      error
    );
    // Return default channels on error
    return ['in_app', 'email'];
  }
};

/**
 * Schedule meeting reminders for all participants
 * @param {Object} meeting - Meeting object
 * @param {string} meeting.meetingId - Meeting ID
 * @param {string} meeting.title - Meeting title
 * @param {string} meeting.description - Meeting description
 * @param {Date} meeting.scheduledTime - Meeting scheduled time
 * @param {number} meeting.duration - Meeting duration in minutes
 * @param {string} meeting.createdBy - Meeting creator ID
 * @param {Array<string>} meeting.participants - Participant email addresses
 * @param {string} meeting.timezone - Meeting timezone
 * @returns {Promise<Array>} Array of created notifications
 */
export const scheduleMeetingReminders = async (meeting) => {
  try {
    // Input validation
    if (!meeting || !meeting.meetingId) {
      throw new Error('Invalid meeting object');
    }

    if (
      !meeting.scheduledTime ||
      isNaN(new Date(meeting.scheduledTime).getTime())
    ) {
      throw new Error('Invalid meeting scheduled time');
    }

    // Sanitize inputs
    const sanitizedTitle = sanitizeHtml(meeting.title || 'Untitled Meeting', {
      allowedTags: [],
      allowedAttributes: {},
    });

    const sanitizedDescription = sanitizeHtml(meeting.description || '', {
      allowedTags: [],
      allowedAttributes: {},
    });

    const meetingTime = new Date(meeting.scheduledTime);
    const now = new Date();

    // Calculate reminder time (10 minutes before meeting)
    const reminderTime = new Date(
      meetingTime.getTime() - REMINDER_MINUTES * 60 * 1000
    );

    // Don't schedule if reminder time is in the past
    if (reminderTime <= now) {
      console.log(
        `⏭️  Skipping reminder for meeting ${meeting.meetingId} - reminder time in the past`
      );
      return [];
    }

    // Get all participants (including creator)
    const participantEmails = Array.isArray(meeting.participants)
      ? meeting.participants
      : [];

    // Add creator if not in participants
    const allParticipants = new Set([...participantEmails]);

    // Find all user IDs for these emails
    const users = await User.find({
      email: { $in: Array.from(allParticipants) },
    })
      .select('_id email name')
      .lean();

    if (users.length === 0) {
      console.log(
        `⚠️  No registered users found for meeting ${meeting.meetingId}`
      );
      return [];
    }

    // Create notifications for each user
    const notifications = await Promise.all(
      users.map(async (user) => {
        try {
          // Get user-specific notification channels based on preferences
          const channels = await getUserNotificationChannels(
            user._id,
            'meeting_reminder'
          );

          // Skip if no channels enabled
          if (channels.length === 0) {
            console.log(
              `⏭️  Skipping reminder for user ${user.email} - notifications disabled or no channels enabled`
            );
            return null;
          }

          // Create notification record with user-specific channels
          const notification = await Notification.create({
            userId: user._id,
            meetingId: meeting.meetingId,
            type: 'meeting_reminder',
            title: 'Meeting Reminder',
            message: `Your meeting "${sanitizedTitle}" starts in ${REMINDER_MINUTES} minutes`,
            data: {
              meetingId: meeting.meetingId,
              meetingTitle: sanitizedTitle,
              meetingDescription: sanitizedDescription,
              meetingTime: meetingTime.toISOString(),
              duration: meeting.duration || 30,
              timezone: meeting.timezone || 'UTC',
              joinUrl: `${process.env.CLIENT_URL}/room/${meeting.meetingId}`,
              organizerName: meeting.createdByName || 'Unknown',
            },
            status: 'scheduled',
            scheduledAt: reminderTime,
            channels,
            sentChannels: [],
          });

          // Schedule the job in BullMQ with same channels
          const delay = reminderTime.getTime() - now.getTime();
          const job = await getNotificationQueue().addNotificationJob(
            'meeting_reminder',
            {
              notificationId: notification._id.toString(),
              userId: user._id.toString(),
              userName: user.name,
              userEmail: user.email,
              meetingId: meeting.meetingId,
              meetingTitle: sanitizedTitle,
              meetingDescription: sanitizedDescription,
              meetingTime: meetingTime.toISOString(),
              duration: meeting.duration || 30,
              timezone: meeting.timezone || 'UTC',
              joinUrl: `${process.env.CLIENT_URL}/room/${meeting.meetingId}`,
              organizerName: meeting.createdByName || 'Unknown',
              channels,
            },
            {
              delay,
              jobId: `reminder-${notification._id}`,
              priority: 1, // High priority
            }
          );

          // Store job ID for cancellation
          notification.jobId = job.id;
          await notification.save();

          // Audit log
          await auditNotificationScheduled(
            user._id,
            notification._id.toString(),
            meeting.meetingId,
            reminderTime.toISOString()
          );

          console.log(
            `✅ Scheduled reminder for ${
              user.email
            } at ${reminderTime.toISOString()}`
          );

          return notification;
        } catch (error) {
          console.error(
            `❌ Failed to schedule reminder for user ${user._id}:`,
            error
          );
          return null;
        }
      })
    );

    return notifications.filter((n) => n !== null);
  } catch (error) {
    console.error('❌ Failed to schedule meeting reminders:', error);
    throw error;
  }
};

/**
 * Cancel meeting reminders
 * @param {string} meetingId - Meeting ID
 * @param {string} cancelReason - Reason for cancellation
 * @param {string} userId - User who cancelled (for audit)
 * @returns {Promise<number>} Number of reminders cancelled
 */
export const cancelMeetingReminders = async (
  meetingId,
  cancelReason = 'Meeting cancelled',
  userId = null
) => {
  try {
    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }

    // Sanitize cancel reason
    const sanitizedReason = sanitizeHtml(cancelReason, {
      allowedTags: [],
      allowedAttributes: {},
    });

    // Find all pending notifications for this meeting
    const notifications = await Notification.find({
      meetingId,
      status: { $in: ['pending', 'scheduled'] },
    });

    if (notifications.length === 0) {
      console.log(`ℹ️  No pending reminders found for meeting ${meetingId}`);
      return 0;
    }

    let cancelledCount = 0;

    // Cancel each notification
    await Promise.all(
      notifications.map(async (notification) => {
        try {
          // Cancel the BullMQ job
          if (notification.jobId) {
            await getNotificationQueue().cancelNotificationJob(
              notification.jobId
            );
          }

          // Update notification status
          notification.status = 'cancelled';
          notification.cancelledAt = new Date();
          notification.cancelReason = sanitizedReason;
          await notification.save();

          // Audit log
          await auditNotificationCancelled(
            notification.userId,
            notification._id.toString(),
            sanitizedReason
          );

          cancelledCount++;
        } catch (error) {
          console.error(
            `❌ Failed to cancel notification ${notification._id}:`,
            error
          );
        }
      })
    );

    console.log(
      `✅ Cancelled ${cancelledCount} reminders for meeting ${meetingId}`
    );

    return cancelledCount;
  } catch (error) {
    console.error('❌ Failed to cancel meeting reminders:', error);
    throw error;
  }
};

/**
 * Reschedule meeting reminders (cancel old, schedule new)
 * @param {string} meetingId - Meeting ID
 * @param {Object} updatedMeeting - Updated meeting object
 * @param {string} userId - User who updated (for audit)
 * @returns {Promise<Object>} Cancellation and scheduling results
 */
export const rescheduleMeetingReminders = async (
  meetingId,
  updatedMeeting,
  userId = null
) => {
  try {
    // Cancel existing reminders
    const cancelledCount = await cancelMeetingReminders(
      meetingId,
      'Meeting rescheduled',
      userId
    );

    // Schedule new reminders
    const newNotifications = await scheduleMeetingReminders(updatedMeeting);

    return {
      cancelled: cancelledCount,
      scheduled: newNotifications.length,
    };
  } catch (error) {
    console.error('❌ Failed to reschedule meeting reminders:', error);
    throw error;
  }
};

/**
 * Update meeting reminder participants (add/remove)
 * @param {string} meetingId - Meeting ID
 * @param {Object} meeting - Full meeting object with updated participants
 * @returns {Promise<Object>} Update results
 */
export const updateMeetingReminderParticipants = async (meetingId, meeting) => {
  try {
    // Get existing notifications
    const existingNotifications = await Notification.find({
      meetingId,
      status: { $in: ['pending', 'scheduled'] },
    }).populate('userId', 'email');

    const existingEmails = new Set(
      existingNotifications.map((n) => n.userId.email)
    );

    const newParticipants = Array.isArray(meeting.participants)
      ? meeting.participants
      : [];
    const newEmails = new Set(newParticipants);

    // Find removed participants
    const removedEmails = Array.from(existingEmails).filter(
      (email) => !newEmails.has(email)
    );

    // Find added participants
    const addedEmails = Array.from(newEmails).filter(
      (email) => !existingEmails.has(email)
    );

    let removedCount = 0;
    let addedCount = 0;

    // Cancel reminders for removed participants
    if (removedEmails.length > 0) {
      const removedNotifications = existingNotifications.filter((n) =>
        removedEmails.includes(n.userId.email)
      );

      await Promise.all(
        removedNotifications.map(async (notification) => {
          try {
            if (notification.jobId) {
              await getNotificationQueue().cancelNotificationJob(
                notification.jobId
              );
            }
            notification.status = 'cancelled';
            notification.cancelledAt = new Date();
            notification.cancelReason = 'Participant removed from meeting';
            await notification.save();
            removedCount++;
          } catch (error) {
            console.error(
              `❌ Failed to cancel notification ${notification._id}:`,
              error
            );
          }
        })
      );
    }

    // Schedule reminders for added participants
    if (addedEmails.length > 0) {
      const addedUsers = await User.find({
        email: { $in: addedEmails },
      })
        .select('_id email name')
        .lean();

      // Create a mock meeting object with only added participants
      const meetingForNew = {
        ...meeting,
        participants: addedEmails,
      };

      const newNotifications = await scheduleMeetingReminders(meetingForNew);
      addedCount = newNotifications.length;
    }

    return {
      removed: removedCount,
      added: addedCount,
    };
  } catch (error) {
    console.error('❌ Failed to update meeting reminder participants:', error);
    throw error;
  }
};

/**
 * Validation middlewares for Express routes
 */
export const validateScheduleReminders = [
  body('meetingId').notEmpty().trim().escape(),
  body('title').notEmpty().trim().isLength({ max: 200 }),
  body('scheduledTime').isISO8601().toDate(),
  body('duration').optional().isInt({ min: 1, max: 480 }),
  body('participants').isArray(),
  body('participants.*').isEmail(),
];

export const validateCancelReminders = [
  param('meetingId').notEmpty().trim().escape(),
];

/**
 * Handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

export default {
  scheduleMeetingReminders,
  cancelMeetingReminders,
  rescheduleMeetingReminders,
  updateMeetingReminderParticipants,
  validateScheduleReminders,
  validateCancelReminders,
  handleValidationErrors,
};
