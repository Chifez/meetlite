import webpush from 'web-push';
import { models } from '../index.js';

// Track if VAPID has been configured
let vapidConfigured = false;

// Lazy VAPID configuration - only configure when needed
const ensureVapidConfigured = () => {
  if (vapidConfigured) return;

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:noreply@meetlite.com';

  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
    vapidConfigured = true;
  } else {
    throw new Error(
      'VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in your .env file.'
    );
  }
};

/**
 * Send push notification to a specific user
 */
export const sendNotificationToUser = async (userId, payload) => {
  ensureVapidConfigured();
  try {
    // Get all active subscriptions for the user
    const subscriptions = await models.PushSubscription.find({
      userId,
      isActive: true,
    });

    if (subscriptions.length === 0) {
      return { success: false, message: 'No active subscriptions' };
    }

    // Send notification to all user's devices
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
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

          // Update lastUsed
          subscription.lastUsed = new Date();
          await subscription.save();

          return { success: true, subscriptionId: subscription._id };
        } catch (error) {
          // Handle subscription errors (expired, invalid, etc.)
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription expired or invalid, deactivate it
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
      success: true,
      sent: successful,
      failed,
      total: subscriptions.length,
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
};

/**
 * Save push subscription
 */
export const saveSubscription = async (
  userId,
  subscription,
  deviceInfo = {}
) => {
  try {
    // Check if subscription already exists
    let existingSub = await models.PushSubscription.findOne({
      endpoint: subscription.endpoint,
    });

    if (existingSub) {
      // Update existing subscription
      existingSub.userId = userId;
      existingSub.keys = {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      };
      existingSub.deviceInfo = deviceInfo;
      existingSub.isActive = true;
      existingSub.lastUsed = new Date();
      await existingSub.save();
      return existingSub;
    }

    // Create new subscription
    const newSubscription = new models.PushSubscription({
      userId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      deviceInfo,
      isActive: true,
    });

    await newSubscription.save();
    return newSubscription;
  } catch (error) {
    console.error('Error saving subscription:', error);
    throw error;
  }
};

/**
 * Remove push subscription
 */
export const removeSubscription = async (endpoint) => {
  try {
    const subscription = await models.PushSubscription.findOne({ endpoint });

    if (subscription) {
      subscription.isActive = false;
      await subscription.save();
      return { success: true, message: 'Subscription removed' };
    }

    return { success: false, message: 'Subscription not found' };
  } catch (error) {
    console.error('Error removing subscription:', error);
    throw error;
  }
};

/**
 * Get user's active subscriptions
 */
export const getUserSubscriptions = async (userId) => {
  return models.PushSubscription.find({ userId, isActive: true });
};
