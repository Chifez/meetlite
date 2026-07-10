// @ts-ignore
import webpush from 'web-push';
import { prisma } from '@minimeet/shared';

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
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId,
      }
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
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            JSON.stringify(payload)
          );

          // lastUsed was removed in Prisma

          return { success: true, subscriptionId: subscription.id };
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) {
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
    let existingSub = await prisma.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint }
    });

    if (existingSub) {
      existingSub = await prisma.pushSubscription.update({
        where: { id: existingSub.id },
        data: {
          userId,
          keysP256dh: subscription.keys.p256dh,
          keysAuth: subscription.keys.auth,
          userAgent: deviceInfo?.userAgent || null,
        }
      });
      return existingSub;
    }

    const newSubscription = await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        keysP256dh: subscription.keys.p256dh,
        keysAuth: subscription.keys.auth,
        userAgent: deviceInfo?.userAgent || null,
      }
    });

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
    const subscription = await prisma.pushSubscription.findUnique({
      where: { endpoint }
    });

    if (subscription) {
      await prisma.pushSubscription.delete({
        where: { id: subscription.id }
      });
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
  return prisma.pushSubscription.findMany({
    where: { userId }
  });
};
