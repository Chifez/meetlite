import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCheck, Trash2, BellOff } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import SEO from '@/components/seo';

export default function Notifications() {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = async (notificationId: string, url?: string) => {
    await markAsRead(notificationId);
    if (url) navigate(url);
  };

  // ── LOADING STATE ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <DashboardLayout>
        <SEO title="Notifications · MeetLite" />
        <div className="space-y-1">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-52" />
        </div>
        <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-4">
              <Skeleton className="w-8 h-8 rounded-xl flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-full max-w-xs" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SEO title="Notifications · MeetLite" />

      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[1.25rem] font-bold text-foreground tracking-[-0.025em]">
            Notifications
          </h1>
          <p className="text-[0.8125rem] text-muted-foreground mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'You\'re all caught up.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            id="mark-all-read-btn"
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            className="gap-1.5"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      {/* ── EMPTY STATE ── */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 border border-border rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <BellOff className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[0.9375rem] font-semibold text-foreground tracking-[-0.01em]">
              No notifications
            </p>
            <p className="text-[0.8125rem] text-muted-foreground mt-1">
              You'll be notified here when meetings are scheduled, invitations arrive, or recordings are ready.
            </p>
          </div>
        </div>
      ) : (
        // ── POPULATED STATE ──
        <div className="border border-border rounded-2xl overflow-hidden">
          <ScrollArea className="h-[600px]">
            <div className="divide-y divide-border">
              {(() => {
                const today: any[] = [];
                const yesterday: any[] = [];
                const earlier: any[] = [];

                notifications.forEach(n => {
                  const date = new Date(n.createdAt);
                  if (isToday(date)) today.push(n);
                  else if (isYesterday(date)) yesterday.push(n);
                  else earlier.push(n);
                });

                const renderGroup = (title: string, group: any[]) => {
                  if (group.length === 0) return null;
                  return (
                    <div className="pb-4">
                      <div className="px-5 py-3 bg-surface-sunken/50 border-b border-border/50">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{title}</h3>
                      </div>
                      <div className="divide-y divide-border/50">
                        {group.map((notification) => {
                          const isUnread = !notification.read;
                          const notificationUrl =
                            notification.data?.joinUrl ||
                            notification.data?.url ||
                            '/dashboard';

                          return (
                            <div
                              key={notification.id}
                              className={cn(
                                'flex items-start gap-3 px-5 py-4 hover:bg-muted/40 transition-colors duration-100'
                              )}
                            >
                              {/* Unread dot */}
                              <div className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0">
                                {isUnread && (
                                  <span className="block w-2 h-2 rounded-full bg-primary" />
                                )}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  'text-[0.875rem] leading-snug text-foreground',
                                  isUnread ? 'font-semibold' : 'font-medium'
                                )}>
                                  {notification.title}
                                </p>
                                <p className="text-[0.8125rem] text-muted-foreground mt-0.5 leading-relaxed">
                                  {notification.message}
                                </p>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-[0.75rem] text-muted-foreground/70 tabular-nums">
                                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                  </span>
                                  {notification.data?.meetingId && (
                                    <button
                                      className="text-[0.75rem] font-semibold text-primary hover:underline"
                                      onClick={() =>
                                        handleNotificationClick(notification.id, notificationUrl)
                                      }
                                    >
                                      View meeting →
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {isUnread && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    title="Mark as read"
                                    onClick={() => markAsRead(notification.id)}
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title="Delete"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteNotification(notification.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {renderGroup('Today', today)}
                    {renderGroup('Yesterday', yesterday)}
                    {renderGroup('Earlier', earlier)}
                  </>
                );
              })()}
            </div>
          </ScrollArea>
        </div>
      )}
    </DashboardLayout>
  );
}
