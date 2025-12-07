import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface DeleteMeetingModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  meetingTitle?: string;
  deleting?: boolean;
}

export default function DeleteMeetingModal({
  open,
  onConfirm,
  onCancel,
  meetingTitle,
  deleting = false,
}: DeleteMeetingModalProps) {
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !deleting) {
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Meeting?</DialogTitle>
          <DialogDescription>
            {meetingTitle ? (
              <>
                Are you sure you want to delete{' '}
                <span className="font-semibold">{meetingTitle}</span>? This
                action cannot be undone.
              </>
            ) : (
              <>
                Are you sure you want to delete this meeting? This action cannot
                be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
