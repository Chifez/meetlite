import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export default function Notifications() {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = async (
    notificationId: string,
    url?: string
  ) => {
    await markAsRead(notificationId);
    if (url) {
      navigate(url);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Notifications</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="divide-y">
                {notifications.map((notification) => {
                  const isUnread = !notification.read;
                  const notificationUrl =
                    notification.data?.joinUrl ||
                    notification.data?.url ||
                    '/dashboard';

                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'p-4 hover:bg-muted/50 transition-colors',
                        isUnread && 'bg-muted/30'
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3
                              className={cn(
                                'text-sm font-medium',
                                isUnread && 'font-semibold'
                              )}
                            >
                              {notification.title}
                            </h3>
                            {isUnread && (
                              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-4">
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(
                                new Date(notification.createdAt),
                                {
                                  addSuffix: true,
                                }
                              )}
                            </p>
                            {notification.data?.meetingId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 text-xs"
                                onClick={() =>
                                  handleNotificationClick(
                                    notification.id,
                                    notificationUrl
                                  )
                                }
                              >
                                View Meeting
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isUnread && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <CheckCheck className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


