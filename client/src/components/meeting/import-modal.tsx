import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useMeetingsStore } from '@/stores';

export default function ImportModal({
  open,
  onClose,
  importLoading,
  importError,
  importedEvents,
  onImport,
  isConnected,
  refreshConnectionStatus,
  disconnectCalendar,
  isPolling,
}: {
  open: boolean;
  onClose: () => void;
  importLoading: boolean;
  importError: string | null;
  importedEvents: any[];
  onImport: (type: 'google') => void;
  isConnected?: (type: 'google') => boolean;
  refreshConnectionStatus?: () => void;
  disconnectCalendar?: (type: 'google') => Promise<boolean>;
  isPolling?: boolean;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { refreshGoogleCalendarEvents } = useMeetingsStore();

  const handleRefreshConnection = async () => {
    try {
      setRefreshing(true);
      if (refreshConnectionStatus) {
        await refreshConnectionStatus();
      }
      if (isConnected?.('google')) {
        await refreshGoogleCalendarEvents();
      }
    } catch (error) {
      console.error('Failed to refresh connection status:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectCalendar) return;
    try {
      setDisconnecting(true);
      await disconnectCalendar('google');
    } catch (error) {
      console.error('Failed to disconnect calendar:', error);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && (importLoading || refreshing || disconnecting || isPolling)) {
      return;
    }
    onClose();
  };

  const isGoogleConnected = Boolean(isConnected?.('google'));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden border border-[#DAD7CF] dark:border-neutral-800 shadow-xl rounded-xl">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-[#DAD7CF] dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#EEEDE8] dark:bg-neutral-800 flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold tracking-tight text-foreground">
                Calendar Integrations
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Connect external calendars to prevent double-booking and import upcoming meetings.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Provider Card List */}
          <div className="border border-[#DAD7CF] dark:border-neutral-800 rounded-lg overflow-hidden divide-y divide-[#DAD7CF] dark:divide-neutral-800">
            {/* Google Calendar */}
            <div className="p-3.5 flex items-center justify-between gap-3 bg-card">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-md bg-[#F4F3EF] dark:bg-neutral-800 flex items-center justify-center shrink-0 border border-[#DAD7CF]/50 dark:border-neutral-700">
                  <img src="/google.svg" alt="Google" className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">Google Calendar</span>
                    {isGoogleConnected && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#E1F5EE] text-[#0F6E56] dark:bg-[#0F6E56]/20 dark:text-[#5DCAA5]">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {isGoogleConnected
                      ? 'Syncing active schedule and checking availability.'
                      : 'Connect to sync events and enable conflict detection.'}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="shrink-0 flex items-center gap-1.5">
                {isGoogleConnected ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onImport('google')}
                    disabled={importLoading || isPolling || refreshing}
                    className="h-8 px-2.5 text-xs font-medium border-[#DAD7CF] dark:border-neutral-800 hover:bg-muted"
                  >
                    {importLoading ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      'Sync Now'
                    )}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => onImport('google')}
                    disabled={importLoading || isPolling}
                    className="h-8 px-3 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isPolling ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Waiting...
                      </>
                    ) : (
                      'Connect'
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Outlook / Microsoft Calendar */}
            <div className="p-3.5 flex items-center justify-between gap-3 bg-muted/20 opacity-70">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-md bg-[#F4F3EF] dark:bg-neutral-800 flex items-center justify-center shrink-0 border border-[#DAD7CF]/50 dark:border-neutral-700">
                  <img src="/microsoft.svg" alt="Microsoft" className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">Microsoft Outlook</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#DAD7CF] text-muted-foreground font-normal">
                      Coming Soon
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Office 365 and Exchange integration in progress.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sync Polling State */}
          {isPolling && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 text-primary text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Waiting for Google authentication to finish in your browser window...</span>
            </div>
          )}

          {/* Error Message */}
          {importError && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">
                <span>{importError}</span>
                {importError.includes('OAuth') && (
                  <p className="mt-1 text-[11px] opacity-80">
                    If you just granted permissions, click "Refresh Status" below.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Refresh & Disconnect Controls */}
          {refreshConnectionStatus && (
            <div className="flex items-center justify-between pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshConnection}
                disabled={refreshing || isPolling}
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh Status'}
              </Button>

              {isGoogleConnected && disconnectCalendar && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting || isPolling}
                  className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10"
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect Google'}
                </Button>
              )}
            </div>
          )}

          {/* Imported Meetings Section */}
          {importedEvents.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">
                  Imported Meetings ({importedEvents.length})
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-[#DAD7CF] dark:border-neutral-800 rounded-lg p-2 bg-muted/10">
                {importedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-2 rounded-md bg-card border border-[#DAD7CF]/60 dark:border-neutral-800 text-xs space-y-0.5"
                  >
                    <div className="font-semibold text-foreground truncate">
                      {event.title || 'Untitled Meeting'}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {event.start} – {event.end}
                    </div>
                    {event.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {event.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Close Button */}
          <div className="flex items-center justify-end pt-3 border-t border-[#DAD7CF] dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={importLoading || refreshing || disconnecting}
              className="h-8 px-4 text-xs font-medium border-[#DAD7CF] dark:border-neutral-800"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
