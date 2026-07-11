import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import Cookies from 'js-cookie';
import api from '@/lib/axios';
import { env } from '@/config/env';
import { useAuth } from '@/hooks/use-auth';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  status?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface NotificationsContextType {
  // State
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  pagination: NotificationPagination | null;

  // Actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  fetchNotifications: (page?: number, limit?: number) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  retryConnection: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(
  undefined
);

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<NotificationPagination | null>(
    null
  );

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const currentPageRef = useRef(1);
  const maxReconnectAttempts = 5;

  const getReconnectDelay = (attempt: number): number => {
    const delay = 3000 * Math.pow(2, attempt - 1);
    return Math.min(delay, 60000);
  };

  const fetchNotifications = useCallback(async (page = 1, limit = 20) => {
    try {
      setIsLoading(true);
      setError(null);
      currentPageRef.current = page;

      const response = await api.get('/api/notifications', {
        params: { page, limit },
      });

      if (response.data.success) {
        const {
          notifications: fetchedNotifications,
          pagination: paginationData,
        } = response.data.data;

        if (page === 1) {
          setNotifications(fetchedNotifications);
        } else {
          setNotifications((prev) => [...prev, ...fetchedNotifications]);
        }

        setPagination(paginationData);
      }
    } catch (err: any) {
      console.error('Failed to fetch notifications:', err);
      setError(err.response?.data?.error || 'Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await api.get('/api/notifications/unread-count');
      if (response.data.success) {
        setUnreadCount(response.data.data.count);
      }
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await api.patch(`/api/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, read: true, readAt: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error('Failed to mark notification as read:', err);
      throw err;
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.post('/api/notifications/read-all');
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read: true,
          readAt: n.readAt || new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch (err: any) {
      console.error('Failed to mark all as read:', err);
      throw err;
    }
  }, []);

  const deleteNotification = useCallback(
    async (notificationId: string) => {
      try {
        await api.delete(`/api/notifications/${notificationId}`);
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        const notification = notifications.find((n) => n.id === notificationId);
        if (notification && !notification.read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err: any) {
        console.error('Failed to delete notification:', err);
        throw err;
      }
    },
    [notifications]
  );

  const refreshNotifications = useCallback(async () => {
    await Promise.all([fetchNotifications(1), fetchUnreadCount()]);
  }, [fetchNotifications, fetchUnreadCount]);

  const setupSSE = useCallback(async () => {
    try {
      const token = Cookies.get('token');
      if (!token) return;

      // Read notification preference from auth context — no extra network call needed
      const notifyEnabled = (user as any)?.notificationPreferences?.enabled;
      if (notifyEnabled === false) {
        setError(null);
        setIsConnected(false);
        return;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const sseUrl = `${env.API_GATEWAY_URL}/api/notifications/stream?token=${encodeURIComponent(token)}`;
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;
      reconnectAttemptsRef.current = 0;

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connected') return;

          if (data.type === 'error') {
            console.error('❌ SSE error from server:', data);
            let errorMessage = data.message || 'Connection error occurred';
            if (data.error === 'CONNECTION_LIMIT_EXCEEDED') {
              errorMessage = 'Server is at capacity. Please try again in a moment.';
            }
            setError(errorMessage);
            setIsConnected(false);
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
              eventSourceRef.current = null;
            }
            return;
          }

          if (event.data.startsWith(':')) return;

          if (data.id || data.type) {
            setNotifications((prev) => [data, ...prev]);
            if (!data.read) {
              setUnreadCount((prev) => prev + 1);
            }
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(data.title, {
                body: data.message,
                icon: '/favicon.ico',
                tag: data.id,
              });
            }
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('❌ SSE connection error:', err);
        setIsConnected(false);
        const readyState = eventSource.readyState;

        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = getReconnectDelay(reconnectAttemptsRef.current);
          if (readyState !== EventSource.CONNECTING) {
            setError(`Connection lost. Reconnecting... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          } else {
            setError('');
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            setupSSE();
          }, delay);
        } else {
          setError('Unable to connect to notification service. Please check your internet connection and try again, or refresh the page.');
        }
      };
    } catch (error: any) {
      console.error('Failed to setup notification SSE connection:', error);
      setError('Failed to connect to notification service');
      setIsConnected(false);
    }
  }, [user]);

  const retryConnection = useCallback(async () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    setError(null);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    await setupSSE();
  }, [setupSSE]);

  useEffect(() => {
    setupSSE();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [setupSSE]);

  // Initial data load on auth
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications(1);
      fetchUnreadCount();
    }
  }, [fetchNotifications, fetchUnreadCount, isAuthenticated]);

  // NOTE: Redundant 30s setInterval polling removed.
  // The SSE stream above already pushes new notifications in real-time.
  // The initial fetchUnreadCount() above gives the accurate count on load.

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        isConnected,
        error,
        pagination,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        fetchNotifications,
        refreshNotifications,
        retryConnection,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotificationsContext = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotificationsContext must be used within a NotificationsProvider');
  }
  return context;
};
