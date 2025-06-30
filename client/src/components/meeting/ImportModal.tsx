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
}: {
  open: boolean;
  onClose: () => void;
  importLoading: boolean;
  importError: string | null;
  importedEvents: any[];
  onImport: (type: 'google' | 'outlook') => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Meetings</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 justify-center">
            <Button onClick={() => onImport('google')} disabled={importLoading}>
              Import from Google
            </Button>
            <Button
              onClick={() => onImport('outlook')}
              disabled={importLoading}
            >
              Import from Outlook
            </Button>
          </div>
          {importLoading && (
            <div className="flex items-center gap-2 justify-center text-muted-foreground">
              <Loader2 className="animate-spin w-4 h-4" /> Importing...
            </div>
          )}
          {importError && (
            <div className="text-red-500 text-center">{importError}</div>
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
