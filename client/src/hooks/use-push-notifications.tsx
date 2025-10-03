import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { env } from '@/config/env';

// Convert base64 VAPID key to Uint8Array
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

interface PushNotificationState {
  isSubscribed: boolean;
  isSupported: boolean;
  permission: NotificationPermission;
}

export const usePushNotifications = () => {
  const [state, setState] = useState<PushNotificationState>({
    isSubscribed: false,
    isSupported: 'serviceWorker' in navigator && 'PushManager' in window,
    permission: Notification.permission,
  });

  // Check if user is already subscribed
  const checkSubscription = useCallback(async () => {
    if (!state.isSupported) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      setState((prev) => ({
        ...prev,
        isSubscribed: !!subscription,
      }));
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  }, [state.isSupported]);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission }));

      if (permission === 'granted') {
        return true;
      } else if (permission === 'denied') {
        toast.error('Notification permission denied');
        return false;
      } else {
        toast.info('Notification permission dismissed');
        return false;
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error('Failed to request notification permission');
      return false;
    }
  }, [state.isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      toast.error('Push notifications not supported');
      return false;
    }

    try {
      // Request permission if not granted
      if (Notification.permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Subscribe to push notifications
        const vapidPublicKey = env.VAPID_PUBLIC_KEY;

        if (!vapidPublicKey) {
          toast.error('VAPID public key not configured');
          return false;
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: new Uint8Array(
            urlBase64ToUint8Array(vapidPublicKey)
          ),
        });
      }

      // Send subscription to backend
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        browser: getBrowserName(),
      };

      await api.post(`${env.AUTH_API_URL}/push-notifications/subscribe`, {
        subscription: subscription.toJSON(),
        deviceInfo,
      });

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        permission: 'granted',
      }));
      toast.success('Push notifications enabled!');
      return true;
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast.error('Failed to enable push notifications');
      return false;
    }
  }, [state.isSupported, requestPermission]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from backend
        await api.post(`${env.AUTH_API_URL}/push-notifications/unsubscribe`, {
          endpoint: subscription.endpoint,
        });

        setState((prev) => ({ ...prev, isSubscribed: false }));
        toast.success('Push notifications disabled');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Unsubscribe error:', error);
      toast.error('Failed to disable push notifications');
      return false;
    }
  }, [state.isSupported]);

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    try {
      await api.post(`${env.AUTH_API_URL}/push-notifications/send`, {
        title: 'Test Notification',
        body: 'This is a test notification from MeetLite!',
        data: { type: 'test' },
      });

      toast.success('Test notification sent!');
    } catch (error) {
      console.error('Test notification error:', error);
      toast.error('Failed to send test notification');
    }
  }, []);

  // Check subscription on mount
  useEffect(() => {
    checkSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  return {
    ...state,
    subscribe,
    unsubscribe,
    requestPermission,
    sendTestNotification,
    checkSubscription,
  };
};

// Helper function to get browser name
function getBrowserName(): string {
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'Unknown';
}
