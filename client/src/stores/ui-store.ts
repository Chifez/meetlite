import { create } from 'zustand';

interface UIState {
  // Modal states
  scheduleModal: {
    open: boolean;
  };

  // Loading states
  globalLoading: boolean;

  // Notifications
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
  }>;

  // Theme and preferences
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;

  // Actions
  // Modal actions
  openScheduleModal: () => void;
  closeScheduleModal: () => void;

  // Loading actions
  setGlobalLoading: (loading: boolean) => void;

  // Notification actions
  addNotification: (
    notification: Omit<UIState['notifications'][0], 'id'>
  ) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Theme actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  scheduleModal: { open: false },
  globalLoading: false,
  notifications: [],
  theme: 'system',
  sidebarOpen: false,

  // Modal actions
  openScheduleModal: () => set({ scheduleModal: { open: true } }),
  closeScheduleModal: () => set({ scheduleModal: { open: false } }),

  // Loading actions
  setGlobalLoading: (loading) => set({ globalLoading: loading }),

  // Notification actions
  addNotification: (notification) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification = { ...notification, id };

    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    // Auto-remove notification after duration (default: 5000ms)
    const duration = notification.duration || 5000;
    setTimeout(() => {
      get().removeNotification(id);
    }, duration);
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearNotifications: () => set({ notifications: [] }),

  // Theme actions
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
