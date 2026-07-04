// @ts-ignore
import webpush from 'web-push';
import { PushSubscription } from '@minimeet/shared';

/**
 * Push Notification Service for Room Service
 * Handles sending push notifications directly using shared database
 */

// Track if VAPID has been configured
let vapidConfigured = false;

/**
 * Ensure VAPID keys are configured
 */
const ensureVapidConfigured = () => {
  if (vapidConfigured) return;

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:noreply@meetlite.com';

  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
    vapidConfigured = true;
  } else {
    console.warn(
      '⚠️  VAPID keys not configured. Push notifications will be disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in your .env file.'
    );
  }
};

/**
 * Send push notification to a specific user
 * @param {string} userId - User ID
 * @param {Object} payload - Notification payload
 * @returns {Promise<Object>} Result object
 */
export const sendPushNotificationToUser = async (userId: string, payload: any): Promise<any> => {
  try {
    ensureVapidConfigured();

    if (!vapidConfigured) {
      return { success: false, message: 'VAPID not configured' };
    }

    // Get all active subscriptions for the user
    const subscriptions = await PushSubscription.find({
      userId,
      isActive: true,
    });

    if (subscriptions.length === 0) {
      return { success: false, message: 'No active subscriptions' };
    }

    // Send notification to all user's devices
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription: any) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
              },
            },
            JSON.stringify(payload)
          );

          // Update last used timestamp
          subscription.lastUsed = new Date();
          await subscription.save();

          return { success: true, subscriptionId: subscription._id };
        } catch (error: any) {
          // If subscription is invalid (410 Gone or 404 Not Found), mark as inactive
          if (error.statusCode === 410 || error.statusCode === 404) {
            subscription.isActive = false;
            await subscription.save();
          }
          throw error;
        }
      })
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      success: successful > 0,
      sent: successful,
      failed,
      total: subscriptions.length,
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
};
