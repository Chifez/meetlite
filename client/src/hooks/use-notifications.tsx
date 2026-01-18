import { useState, useEffect, useRef, useCallback } from 'react';
import Cookies from 'js-cookie';
import api from '@/lib/axios';
import { env } from '@/config/env';

interface Notification {
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

interface NotificationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface UseNotificationsReturn {
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

export const useNotifications = (): UseNotificationsReturn => {
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

  /**
   * Calculate exponential backoff delay for reconnection
   * Pattern: 3s, 6s, 12s, 24s, 48s, capped at 60s
   * @param attempt - Current reconnection attempt number (1-indexed)
   * @returns Delay in milliseconds
   */
  const getReconnectDelay = (attempt: number): number => {
    // Exponential backoff: 3000 * 2^(attempt-1)
    // Attempt 1: 3000ms (3s)
    // Attempt 2: 6000ms (6s)
    // Attempt 3: 12000ms (12s)
    // Attempt 4: 24000ms (24s)
    // Attempt 5: 48000ms (48s)
    const delay = 3000 * Math.pow(2, attempt - 1);
    // Cap at 60 seconds
    return Math.min(delay, 60000);
  };

  /**
   * Fetch notifications from API
   */
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
          // Replace notifications for first page
          setNotifications(fetchedNotifications);
        } else {
          // Append for subsequent pages
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

  /**
   * Fetch unread count
   */
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

  /**
   * Mark notification as read
   */
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await api.patch(`/api/notifications/${notificationId}/read`);

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, read: true, readAt: new Date().toISOString() }
            : n
        )
      );

      // Update unread count
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error('Failed to mark notification as read:', err);
      throw err;
    }
  }, []);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    try {
      await api.post('/api/notifications/read-all');

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read: true,
          readAt: n.readAt || new Date().toISOString(),
        }))
      );

      // Reset unread count
      setUnreadCount(0);
    } catch (err: any) {
      console.error('Failed to mark all as read:', err);
      throw err;
    }
  }, []);

  /**
   * Delete notification
   */
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      try {
        await api.delete(`/api/notifications/${notificationId}`);

        // Remove from local state
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

        // Update unread count if it was unread
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

  /**
   * Refresh notifications
   */
  const refreshNotifications = useCallback(async () => {
    await Promise.all([fetchNotifications(1), fetchUnreadCount()]);
  }, [fetchNotifications, fetchUnreadCount]);

  /**
   * Setup SSE connection
   */
  const setupSSE = useCallback(async () => {
      try {
        const token = Cookies.get('token');
        if (!token) {
          return;
        }

        // Fetch fresh profile data to check notification preferences
        const profileResponse = await api.get('/api/auth/profile');
        const profile = profileResponse.data.user || profileResponse.data;

        // Check if notifications are enabled
        const notificationPrefs = profile.notificationPreferences;
        if (notificationPrefs?.enabled === false) {
          console.log('Notifications disabled by user preferences');
          setError(null); // Clear any previous errors since this is intentional
          setIsConnected(false);
          return;
        }

        // Close existing connection if any
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        // Build SSE URL with token in query parameter
        // Note: EventSource doesn't support custom headers, so we pass token as query parameter
        // The server's verifyToken middleware supports both Authorization header and query token
        const sseUrl = `${env.API_GATEWAY_URL}/api/notifications/stream?token=${encodeURIComponent(token)}`;

        // Create EventSource connection
        const eventSource = new EventSource(sseUrl);
        eventSourceRef.current = eventSource;

        // Reset reconnect attempts on successful connection
        reconnectAttemptsRef.current = 0;

        // Connection opened
        eventSource.onopen = () => {
          console.log('✅ Connected to notification SSE stream');
          setIsConnected(true);
          setError(null);
        };

        // Receive messages
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Handle connection confirmation
            if (data.type === 'connected') {
              console.log('📨 Notification SSE connected:', data);
              return;
            }

            // Handle error messages from server
            if (data.type === 'error') {
              console.error('❌ SSE error from server:', data);
              let errorMessage = data.message || 'Connection error occurred';
              
              // Provide specific messages for known error codes
              if (data.error === 'CONNECTION_LIMIT_EXCEEDED') {
                errorMessage = 'Server is at capacity. Please try again in a moment.';
              }
              
              setError(errorMessage);
              setIsConnected(false);
              
              // Close the connection on error
              if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
              }
              return;
            }

            // Handle heartbeat (comments are handled automatically by EventSource)
            if (event.data.startsWith(':')) {
              // Heartbeat comment, ignore
              return;
            }

            // Handle notification
            if (data.id || data.type) {
              console.log('📨 New notification received:', data);

              // Add to notifications list
              setNotifications((prev) => [data, ...prev]);

              // Update unread count if not read
              if (!data.read) {
                setUnreadCount((prev) => prev + 1);
              }

              // Show browser notification if permission granted
              if (
                'Notification' in window &&
                Notification.permission === 'granted'
              ) {
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

        // Handle errors
        eventSource.onerror = (err) => {
          console.error('❌ SSE connection error:', err);
          setIsConnected(false);

          // Determine error type based on EventSource readyState
          const readyState = eventSource.readyState;

          // Close the connection
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }

          // Attempt to reconnect if we haven't exceeded max attempts
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            const delay = getReconnectDelay(reconnectAttemptsRef.current);
            const attemptNumber = reconnectAttemptsRef.current;
            const maxAttempts = maxReconnectAttempts;
            
            // Set error message showing reconnection status (only if not in connecting state)
            if (readyState !== EventSource.CONNECTING) {
              setError(
                `Connection lost. Reconnecting... (${attemptNumber}/${maxAttempts})`
              );
            } else {
              // Clear error if still connecting
              setError('');
            }
            
            console.log(
              `🔄 Attempting to reconnect (${attemptNumber}/${maxAttempts}) in ${delay / 1000}s...`
            );

            reconnectTimeoutRef.current = setTimeout(() => {
              setupSSE();
            }, delay);
          } else {
            // Max attempts reached - provide actionable error message
            setError(
              'Unable to connect to notification service. Please check your internet connection and try again, or refresh the page.'
            );
            console.error('❌ Max reconnection attempts reached');
          }
        };
      } catch (error: any) {
        console.error('Failed to setup notification SSE connection:', error);
        
        // Provide specific error messages based on error type
        let errorMessage = 'Failed to connect to notification service';
        
        if (error.response) {
          // HTTP error response
          const status = error.response.status;
          const errorData = error.response.data;
          
          if (status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (status === 403) {
            errorMessage = 'Access denied. Please check your permissions.';
          } else if (status === 429) {
            errorMessage = 'Too many connection attempts. Please wait a moment and try again.';
          } else if (status === 503) {
            errorMessage = errorData?.message || 'Service temporarily unavailable. Please try again later.';
          } else if (status >= 500) {
            errorMessage = 'Server error. Please try again later.';
          } else {
            errorMessage = errorData?.message || `Connection failed (${status}). Please try again.`;
          }
        } else if (error.request) {
          // Network error (no response received)
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.message) {
          // Other error with message
          if (error.message.includes('token') || error.message.includes('auth')) {
            errorMessage = 'Authentication error. Please log in again.';
          } else {
            errorMessage = `Connection error: ${error.message}`;
          }
        }
        
        setError(errorMessage);
        setIsConnected(false);
      }
    }, []);

  /**
   * Manual retry connection function
   * Allows user to manually retry connecting to SSE stream
   */
  const retryConnection = useCallback(async () => {
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Reset reconnect attempts counter
    reconnectAttemptsRef.current = 0;

    // Clear error state
    setError(null);

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Attempt to reconnect immediately
    console.log('🔄 Manual retry: Attempting to reconnect to notification SSE stream...');
    await setupSSE();
  }, [setupSSE]);

  /**
   * Setup SSE connection on mount
   */
  useEffect(() => {
    setupSSE();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [setupSSE]);

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    fetchNotifications(1);
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  /**
   * Periodic unread count refresh (every 30 seconds)
   */
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  return {
    // State
    notifications,
    unreadCount,
    isLoading,
    isConnected,
    error,
    pagination,

    // Actions
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchNotifications,
    refreshNotifications,
    retryConnection,
  };
};
