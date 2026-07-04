import express, { Request, Response } from 'express';
// @ts-ignore
import { authenticateToken } from '../../middleware/authenticate-token.js';
import {
  saveSubscription,
  removeSubscription,
  getUserSubscriptions,
  sendNotificationToUser,
} from '../../services/push-notification.service.js';

const router = express.Router();

router.get('/vapid-public-key', (req: Request, res: Response) => {
  res.json({
    success: true,
    publicKey: process.env.VAPID_PUBLIC_KEY,
  });
});

router.use(authenticateToken);

router.post('/subscribe', async (req: any, res: Response) => {
  try {
    const { subscription, deviceInfo } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription data',
      });
    }

    const savedSubscription = await saveSubscription(
      req.user._id,
      subscription,
      deviceInfo
    );

    res.status(201).json({
      success: true,
      message: 'Subscription saved successfully',
      subscription: {
        id: savedSubscription._id,
        endpoint: savedSubscription.endpoint,
      },
    });
  } catch (error: any) {
    console.error('Subscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save subscription',
      error: error.message,
    });
  }
});

router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Endpoint is required',
      });
    }

    const result = await removeSubscription(endpoint);

    res.json(result);
  } catch (error: any) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove subscription',
      error: error.message,
    });
  }
});

router.get('/subscriptions', async (req: any, res: Response) => {
  try {
    const subscriptions = await getUserSubscriptions(req.user._id);

    res.json({
      success: true,
      count: subscriptions.length,
      subscriptions: subscriptions.map((sub: any) => ({
        id: sub._id,
        endpoint: sub.endpoint,
        deviceInfo: sub.deviceInfo,
        createdAt: sub.createdAt,
        lastUsed: sub.lastUsed,
      })),
    });
  } catch (error: any) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscriptions',
      error: error.message,
    });
  }
});

router.post('/send', async (req: any, res: Response) => {
  try {
    const { title, body, data } = req.body;

    const payload = {
      title: title || 'Test Notification',
      body: body || 'This is a test notification from MeetLite',
      icon: '/android-chrome-192x192.png',
      badge: '/android-chrome-192x192.png',
      data: data || {},
    };

    const result = await sendNotificationToUser(req.user._id, payload);

    res.json({
      success: true,
      message: 'Notification sent',
      result,
    });
  } catch (error: any) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: error.message,
    });
  }
});

export default router;
