// @ts-ignore
import webpush from 'web-push';
import { models } from '../index.js';

let vapidConfigured = false;

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
export const sendNotificationToUser = async (userId: any, payload: any) => {
  ensureVapidConfigured();
  try {
    const subscriptions = await models.PushSubscription.find({
      userId,
      isActive: true,
    });

    if (subscriptions.length === 0) {
      return { success: false, message: 'No active subscriptions' };
    }

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

          subscription.lastUsed = new Date();
          await subscription.save();

          return { success: true, subscriptionId: subscription._id };
        } catch (error: any) {
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
  userId: any,
  subscription: any,
  deviceInfo: any = {}
) => {
  try {
    let existingSub = await models.PushSubscription.findOne({
      endpoint: subscription.endpoint,
    });

    if (existingSub) {
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
export const removeSubscription = async (endpoint: string) => {
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
export const getUserSubscriptions = async (userId: any) => {
  return models.PushSubscription.find({ userId, isActive: true });
};
