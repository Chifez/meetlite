import React, { useState, useEffect, useCallback } from 'react';
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
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCircle,
  Mail,
  Smartphone,
  Monitor,
  Send,
  XCircle,
  Loader2,
} from 'lucide-react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import api from '@/lib/axios';
import { toast } from 'sonner';

interface NotificationPreferences {
  enabled: boolean;
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  types: {
    meetingReminders: boolean;
    meetingInvitations: boolean;
    meetingUpdates: boolean;
    recordingReady: boolean;
  };
}

interface NotificationSettingsProps {}

export const NotificationSettings: React.FC<NotificationSettingsProps> = () => {
  const {
    isSubscribed,
    isSupported: isPushSupported,
    permission: pushPermission,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    sendTestNotification,
  } = usePushNotifications();

  const [preferences, setPreferences] = useState<NotificationPreferences>({
    enabled: true,
    channels: {
      inApp: true,
      email: true,
      push: false,
    },
    types: {
      meetingReminders: true,
      meetingInvitations: true,
      meetingUpdates: true,
      recordingReady: true,
    },
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch user preferences
  const fetchPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/auth/profile');
      const user = response.data.user || response.data;

      if (user.notificationPreferences) {
        setPreferences(user.notificationPreferences);
      }
    } catch (error) {
      console.error('Failed to fetch notification preferences:', error);
      toast.error('Failed to load notification preferences');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save preferences to backend
  const savePreferences = useCallback(async (newPreferences: NotificationPreferences) => {
    try {
      setIsSaving(true);
      await api.patch('/api/auth/profile', {
        notificationPreferences: newPreferences,
      });
      setPreferences(newPreferences);
      toast.success('Notification preferences saved');
    } catch (error: any) {
      console.error('Failed to save preferences:', error);
      toast.error(error.response?.data?.message || 'Failed to save preferences');
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Handle master toggle
  const handleMasterToggle = useCallback(
    async (enabled: boolean) => {
      const newPreferences = {
        ...preferences,
        enabled,
      };
      await savePreferences(newPreferences);
    },
    [preferences, savePreferences]
  );

  // Handle channel toggle
  const handleChannelToggle = useCallback(
    async (channel: 'inApp' | 'email' | 'push', enabled: boolean) => {
      // Special handling for push - need to subscribe/unsubscribe
      if (channel === 'push') {
        if (enabled) {
          const subscribed = await subscribePush();
          if (!subscribed) {
            return; // Don't update preferences if subscription failed
          }
        } else {
          await unsubscribePush();
        }
      }

      const newPreferences = {
        ...preferences,
        channels: {
          ...preferences.channels,
          [channel]: enabled,
        },
      };
      await savePreferences(newPreferences);
    },
    [preferences, savePreferences, subscribePush, unsubscribePush]
  );

  // Handle notification type toggle
  const handleTypeToggle = useCallback(
    async (
      type: 'meetingReminders' | 'meetingInvitations' | 'meetingUpdates' | 'recordingReady',
      enabled: boolean
    ) => {
      const newPreferences = {
        ...preferences,
        types: {
          ...preferences.types,
          [type]: enabled,
        },
      };
      await savePreferences(newPreferences);
    },
    [preferences, savePreferences]
  );

  // Sync push subscription status with preferences
  useEffect(() => {
    if (isPushSupported && pushPermission === 'granted') {
      const pushEnabled = preferences.channels.push;
      if (pushEnabled && !isSubscribed) {
        // User wants push but not subscribed - try to subscribe
        subscribePush();
      } else if (!pushEnabled && isSubscribed) {
        // User doesn't want push but is subscribed - unsubscribe
        unsubscribePush();
      }
    }
  }, [preferences.channels.push, isSubscribed, isPushSupported, pushPermission, subscribePush, unsubscribePush]);

  // Fetch preferences on mount
  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Master Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Control how you receive notifications about meetings and updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications-enabled" className="text-base">
                Enable Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Master switch for all notifications
              </p>
            </div>
            <Switch
              id="notifications-enabled"
              checked={preferences.enabled}
              onCheckedChange={handleMasterToggle}
              disabled={isSaving}
            />
          </div>

          {!preferences.enabled && (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                All notifications are disabled. Enable notifications to configure channels and types.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channel Preferences */}
      {preferences.enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Notification Channels</CardTitle>
            <CardDescription>
              Choose how you want to receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* In-App Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Monitor className="h-5 w-5 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label htmlFor="channel-inapp" className="text-base">
                    In-App Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Show notifications in the app
                  </p>
                </div>
              </div>
              <Switch
                id="channel-inapp"
                checked={preferences.channels.inApp}
                onCheckedChange={(enabled) => handleChannelToggle('inApp', enabled)}
                disabled={isSaving}
              />
            </div>

            <Separator />

            {/* Email Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label htmlFor="channel-email" className="text-base">
                    Email Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
              </div>
              <Switch
                id="channel-email"
                checked={preferences.channels.email}
                onCheckedChange={(enabled) => handleChannelToggle('email', enabled)}
                disabled={isSaving}
              />
            </div>

            <Separator />

            {/* Push Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label htmlFor="channel-push" className="text-base">
                    Push Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications even when the app is closed
                  </p>
                </div>
              </div>
              <Switch
                id="channel-push"
                checked={preferences.channels.push && isSubscribed}
                onCheckedChange={(enabled) => handleChannelToggle('push', enabled)}
                disabled={isSaving || !isPushSupported}
              />
            </div>

            {/* Push Notification Status */}
            {isPushSupported && (
              <div className="rounded-lg bg-muted p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Push Notification Status</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isSubscribed && pushPermission === 'granted' && (
                        <>
                          <CheckCircle className="inline h-4 w-4 mr-1 text-green-500" />{' '}
                          Active - Push notifications enabled
                        </>
                      )}
                      {!isSubscribed && pushPermission === 'granted' && (
                        <>
                          <AlertCircle className="inline h-4 w-4 mr-1 text-yellow-500" />{' '}
                          Permission granted - Enable above to subscribe
                        </>
                      )}
                      {pushPermission === 'denied' && (
                        <>
                          <XCircle className="inline h-4 w-4 mr-1 text-red-500" />{' '}
                          Blocked - Reset in browser settings
                        </>
                      )}
                      {pushPermission === 'default' && (
                        <>
                          <AlertCircle className="inline h-4 w-4 mr-1 text-gray-500" />{' '}
                          Not enabled - Enable above to request permission
                        </>
                      )}
                    </p>
                  </div>
                  {isSubscribed && pushPermission === 'granted' && (
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
            )}

            {!isPushSupported && (
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  Push notifications are not supported in your browser
                </p>
              </div>
            )}

            {pushPermission === 'denied' && (
              <div className="rounded-lg bg-destructive/10 p-4">
                <p className="text-sm text-destructive">
                  <strong>Notifications Blocked:</strong> You've blocked notifications for this site.
                  To enable them, click the lock icon in your browser's address bar and allow notifications.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notification Types */}
      {preferences.enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Notification Types</CardTitle>
            <CardDescription>
              Choose which types of notifications you want to receive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="type-reminders" className="text-base">
                  Meeting Reminders
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get reminded before meetings start
                </p>
              </div>
              <Switch
                id="type-reminders"
                checked={preferences.types.meetingReminders}
                onCheckedChange={(enabled) => handleTypeToggle('meetingReminders', enabled)}
                disabled={isSaving}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="type-invitations" className="text-base">
                  Meeting Invitations
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when invited to meetings
                </p>
              </div>
              <Switch
                id="type-invitations"
                checked={preferences.types.meetingInvitations}
                onCheckedChange={(enabled) => handleTypeToggle('meetingInvitations', enabled)}
                disabled={isSaving}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="type-updates" className="text-base">
                  Meeting Updates
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when meetings are updated or cancelled
                </p>
              </div>
              <Switch
                id="type-updates"
                checked={preferences.types.meetingUpdates}
                onCheckedChange={(enabled) => handleTypeToggle('meetingUpdates', enabled)}
                disabled={isSaving}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="type-recordings" className="text-base">
                  Recording Ready
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when recordings are processed
                </p>
              </div>
              <Switch
                id="type-recordings"
                checked={preferences.types.recordingReady}
                onCheckedChange={(enabled) => handleTypeToggle('recordingReady', enabled)}
                disabled={isSaving}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
