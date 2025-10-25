import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';
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

      // First refresh connection status
      if (refreshConnectionStatus) {
        await refreshConnectionStatus();
      }

      // Then refresh Google Calendar events if connected
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
      const success = await disconnectCalendar('google');
      if (success) {
        // Connection status will be updated automatically
      }
    } catch (error) {
      console.error('Failed to disconnect calendar:', error);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Meetings</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 justify-center">
            {/* Google Calendar */}
            <Button
              onClick={() => onImport('google')}
              disabled={importLoading || isPolling}
              className="flex items-center gap-2 px-4 py-2"
            >
              <img src="/google.svg" alt="Google" className="w-5 h-5" />
              <span>Google</span>
              {isConnected?.('google') && (
                <Badge
                  variant="secondary"
                  className="text-xs bg-green-100 text-green-800 border-green-200"
                >
                  Connected
                </Badge>
              )}
            </Button>

            {/* Outlook Calendar */}
            <Button
              disabled
              className="flex items-center gap-2 px-4 py-2 opacity-60 cursor-not-allowed relative"
            >
              <img src="/microsoft.svg" alt="Microsoft" className="w-5 h-5" />
              <span>Outlook</span>
              <Badge
                variant="outline"
                className="p-1 text-[10px] absolute -top-4 -right-4 bg-white text-gray-600 border-gray-300 shadow-sm"
              >
                Coming Soon
              </Badge>
            </Button>
          </div>
          <div className="text-sm text-muted-foreground text-center">
            {!isConnected?.('google') &&
              "You'll be prompted to connect your Google calendar first, then import your events."}
            {isConnected?.('google') && 'Google Calendar is connected.'}
          </div>
          {refreshConnectionStatus && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshConnection}
                disabled={refreshing || isPolling}
                className="text-xs flex items-center gap-2"
              >
                <RefreshCw
                  className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`}
                />
                {refreshing ? 'Refreshing...' : 'Refresh Connection Status'}
              </Button>
              {isConnected?.('google') && disconnectCalendar && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting || isPolling}
                  className="text-xs flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${disconnecting ? 'animate-spin' : ''}`}
                  />
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              )}
            </div>
          )}
          {isPolling && (
            <div className="flex items-center gap-2 justify-center text-muted-foreground">
              <Loader2 className="animate-spin w-4 h-4" />
              Waiting for Google authorization to complete...
            </div>
          )}
          {importError && (
            <div className="text-red-500 text-center text-sm">
              {importError}
              {importError.includes('OAuth') && (
                <div className="mt-2 text-xs">
                  After completing the OAuth flow, click "Refresh Connection
                  Status" above.
                </div>
              )}
            </div>
          )}
          {importedEvents.length > 0 && (
            <div className="max-h-64 overflow-y-auto mt-2">
              <h4 className="font-semibold mb-2 text-center">
                Imported Meetings
              </h4>
              <ul className="space-y-2">
                {importedEvents.map((event) => (
                  <li key={event.id} className="bg-muted rounded p-2">
                    <div className="font-medium">{event.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {event.start} - {event.end}
                    </div>
                    {event.description && (
                      <div className="text-xs mt-1">{event.description}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
