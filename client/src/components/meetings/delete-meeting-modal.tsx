import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DeleteMeetingModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  meetingTitle?: string;
}

export default function DeleteMeetingModal({
  open,
  onConfirm,
  onCancel,
  meetingTitle,
}: DeleteMeetingModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
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
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
