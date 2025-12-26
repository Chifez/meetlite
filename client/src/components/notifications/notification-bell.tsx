import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface NotificationBellProps {
  variant?: 'sidebar' | 'breadcrumb';
  className?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  variant = 'sidebar',
  className,
}) => {
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
  } = useNotifications();
  const navigate = useNavigate();

  // Refresh notifications when popover opens
  React.useEffect(() => {
    if (open) {
      refreshNotifications();
    }
  }, [open, refreshNotifications]);

  const handleNotificationClick = async (
    notificationId: string,
    url?: string
  ) => {
    if (!url) return;

    await markAsRead(notificationId);
    setOpen(false);
    navigate(url);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const recentNotifications = notifications.slice(0, 5);
  const hasUnread = unreadCount > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative',
            variant === 'sidebar' && 'text-sidebar-foreground hover:bg-sidebar-accent',
            variant === 'breadcrumb' && 'hover:bg-muted',
            className
          )}
        >
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          'w-80 p-0',
          variant === 'breadcrumb' && 'mr-4'
        )}
        align={variant === 'sidebar' ? 'end' : 'start'}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs"
              onClick={handleMarkAllAsRead}
            >
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-muted-foreground">
                No notifications
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {recentNotifications.map((notification) => {
                const isUnread = !notification.read;
                const notificationUrl =
                  notification.data?.joinUrl ||
                  notification.data?.url ||
                  '/dashboard';

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-4 cursor-pointer transition-colors hover:bg-muted/50',
                      isUnread && 'bg-muted/30'
                    )}
                    onClick={() =>
                      handleNotificationClick(notification.id, notificationUrl)
                    }
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p
                            className={cn(
                              'text-sm font-medium',
                              isUnread && 'font-semibold'
                            )}
                          >
                            {notification.title}
                          </p>
                          {isUnread && (
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {recentNotifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  setOpen(false);
                  navigate('/notifications');
                }}
              >
                View all notifications
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

