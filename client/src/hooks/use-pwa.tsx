import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface PWAState {
  isInstalled: boolean;
  isOnline: boolean;
  hasUpdate: boolean;
  canInstall: boolean;
}

export const usePWA = () => {
  const [pwaState, setPwaState] = useState<PWAState>({
    isInstalled: false,
    isOnline: navigator.onLine,
    hasUpdate: false,
    canInstall: false,
  });

  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        setRegistration(reg);
        return reg;
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }, []);

  // Install PWA
  const installPWA = useCallback(async () => {
    if (pwaState.canInstall && registration) {
      try {
        await (registration as any).prompt();
        setPwaState((prev) => ({ ...prev, isInstalled: true }));
        toast.success('MeetLite installed successfully!');
      } catch (error) {
        console.error('PWA installation failed:', error);
        toast.error('Failed to install app');
      }
    }
  }, [pwaState.canInstall, registration]);

  // Check if app is installed
  const checkInstallation = useCallback(() => {
    const isInstalled =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setPwaState((prev) => ({ ...prev, isInstalled }));
  }, []);

  // Handle online/offline status
  const handleOnlineStatus = useCallback(() => {
    setPwaState((prev) => ({ ...prev, isOnline: navigator.onLine }));

    if (navigator.onLine) {
      toast.success('Back online', {
        description: 'Your connection has been restored',
      });
    } else {
      toast.info('You are offline', {
        description: 'Some features may be limited',
      });
    }
  }, []);

  useEffect(() => {
    // Register service worker
    registerServiceWorker();

    // Check installation status
    checkInstallation();

    // Listen for online/offline events
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setPwaState((prev) => ({ ...prev, canInstall: true }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setPwaState((prev) => ({
        ...prev,
        isInstalled: true,
        canInstall: false,
      }));
      toast.success('MeetLite installed successfully!');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [registerServiceWorker, checkInstallation, handleOnlineStatus]);

  return {
    ...pwaState,
    registration,
    installPWA,
    requestNotificationPermission,
  };
};
