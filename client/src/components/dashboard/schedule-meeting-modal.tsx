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
import MeetingForm from '@/components/meeting/meeting-form';
import { Users } from 'lucide-react';

interface ScheduleMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: any;
  formLoading: boolean;
  onInputChange: (e: any) => void;
  onDateChange: (date: any) => void;
  onTimeChange: (time: any) => void;
  onPrivacyChange: (privacy: any) => void;
  onParticipantInput: (e: any) => void;
  onRemoveParticipant: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
  teamId?: string;
  teamName?: string;
}

export default function ScheduleMeetingModal({
  open,
  onOpenChange,
  formData,
  formLoading,
  onInputChange,
  onDateChange,
  onTimeChange,
  onPrivacyChange,
  onParticipantInput,
  onRemoveParticipant,
  onSubmit,
  onCancel,
  teamId,
  teamName,
}: ScheduleMeetingModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>Schedule Meeting</DialogTitle>
            {teamId && teamName && (
              <Badge variant="secondary" className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                <span>@{teamName}</span>
              </Badge>
            )}
          </div>
          {teamId && teamName && (
            <p className="text-sm text-muted-foreground mt-1">
              This meeting will be created for the <strong>@{teamName}</strong>{' '}
              team
            </p>
          )}
        </DialogHeader>
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <MeetingForm
            formData={formData}
            loading={formLoading}
            hideFooter
            onInputChange={onInputChange}
            onDateChange={onDateChange}
            onTimeChange={onTimeChange}
            onPrivacyChange={onPrivacyChange}
            onParticipantInput={onParticipantInput}
            onRemoveParticipant={onRemoveParticipant}
            onSubmit={onSubmit}
            onCancel={onCancel}
          />
        </div>
        <DialogFooter className="flex-shrink-0">
          <Button
            type="button"
            onClick={async () => await onSubmit()}
            className="min-w-[120px]"
            disabled={formLoading}
          >
            {formLoading ? 'Scheduling...' : 'Schedule'}
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
