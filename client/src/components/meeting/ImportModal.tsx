import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle } from 'lucide-react';

export default function ImportModal({
  open,
  onClose,
  importLoading,
  importError,
  importedEvents,
  onImport,
  isConnected,
  refreshConnectionStatus,
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
  isPolling?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Meetings</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => onImport('google')}
              disabled={importLoading || isPolling}
              className="flex items-center gap-2"
            >
              {isConnected?.('google')
                ? 'Import from Google'
                : 'Connect & Import from Google'}
              {isConnected?.('google') && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Connected
                </span>
              )}
            </Button>
            <Button
              disabled
              className="flex items-center gap-2 opacity-60 cursor-not-allowed"
            >
              Import from Outlook (Coming soon)
            </Button>
            <Button
              disabled
              className="flex items-center gap-2 opacity-60 cursor-not-allowed"
            >
              Import from iCal (Coming soon)
            </Button>
          </div>
          <div className="text-sm text-muted-foreground text-center">
            {!isConnected?.('google') &&
              "You'll be prompted to connect your Google calendar first, then import your events."}
            {isConnected?.('google') && 'Google Calendar is connected.'}
          </div>
          {refreshConnectionStatus && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshConnectionStatus}
                className="text-xs"
              >
                Refresh Connection Status
              </Button>
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
