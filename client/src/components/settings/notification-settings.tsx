import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCircle,
  Send,
  XCircle,
} from 'lucide-react';
import { usePushNotifications } from '@/hooks/use-push-notifications';

export const NotificationSettings: React.FC = () => {
  const {
    isSubscribed,
    isSupported,
    permission,
    subscribe,
    unsubscribe,
    sendTestNotification,
  } = usePushNotifications();

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      await subscribe();
    } else {
      await unsubscribe();
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported in your browser
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get notified about meeting reminders and updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="push-notifications" className="text-base">
              Enable Push Notifications
            </Label>
            <p className="text-sm text-muted-foreground">
              Receive notifications even when the app is closed
            </p>
          </div>
          <Switch
            id="push-notifications"
            checked={isSubscribed}
            onCheckedChange={handleToggle}
          />
        </div>

        {/* Permission Status */}
        <div className="rounded-lg bg-muted p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Permission Status</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isSubscribed && permission === 'granted' && (
                  <>
                    <CheckCircle className="inline h-4 w-4 mr-1 text-green-500" />{' '}
                    Active - Notifications enabled
                  </>
                )}
                {!isSubscribed && permission === 'granted' && (
                  <>
                    <AlertCircle className="inline h-4 w-4 mr-1 text-yellow-500" />{' '}
                    Permission granted - Toggle to subscribe
                  </>
                )}
                {!isSubscribed && permission === 'denied' && (
                  <>
                    <XCircle className="inline h-4 w-4 mr-1 text-red-500" />{' '}
                    Blocked - Reset in browser settings
                  </>
                )}
                {!isSubscribed && permission === 'default' && (
                  <>
                    <AlertCircle className="inline h-4 w-4 mr-1 text-gray-500" />{' '}
                    Not enabled - Toggle to activate
                  </>
                )}
              </p>
            </div>
            {isSubscribed && permission === 'granted' && (
              <Button
                variant="outline"
                size="sm"
                onClick={sendTestNotification}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Test
              </Button>
            )}
          </div>
        </div>

        {/* Information */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p className="font-medium">You'll receive notifications for:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Meeting reminders (5 & 10 minutes before)</li>
            <li>Meeting invitations</li>
            <li>Meeting updates and cancellations</li>
            <li>Recording processing completion</li>
          </ul>
        </div>

        {permission === 'denied' && (
          <div className="rounded-lg bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              <strong>Notifications Blocked:</strong> You've blocked
              notifications for this site. To enable them, click the lock icon
              in your browser's address bar and allow notifications.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
