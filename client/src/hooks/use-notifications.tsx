import { useNotificationsContext } from '@/contexts/notifications-context';
import type { Notification, NotificationPagination, NotificationsContextType } from '@/contexts/notifications-context';

export type { Notification, NotificationPagination };
export type UseNotificationsReturn = NotificationsContextType;

export const useNotifications = (): UseNotificationsReturn => {
  return useNotificationsContext();
};
