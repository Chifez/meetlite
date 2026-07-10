// @ts-ignore
import webpush from 'web-push';
import { prisma } from '@minimeet/shared';

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
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId }
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
                p256dh: subscription.keysP256dh,
                auth: subscription.keysAuth,
              },
            },
            JSON.stringify(payload)
          );

          return { success: true, subscriptionId: subscription.id };
        } catch (error: any) {
          // If subscription is invalid (410 Gone or 404 Not Found), mark as inactive
          if (error.statusCode === 404 || error.statusCode === 410) {
            await prisma.pushSubscription.delete({
              where: { id: subscription.id }
            });
          }
          throw error;
        }
      })
    );

    const successful = results.filter((r: any) => r.status === 'fulfilled').length;
    const failed = results.filter((r: any) => r.status === 'rejected').length;

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
