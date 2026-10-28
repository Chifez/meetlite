import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, Calendar, CalendarRange, Repeat } from 'lucide-react';

export type RecurrenceScope = 'occurrence' | 'following' | 'series';

interface MeetingScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'cancel' | 'edit';
  meetingTitle?: string;
  onConfirm: (scope: RecurrenceScope) => Promise<void> | void;
}

export function MeetingScopeDialog({
  open,
  onOpenChange,
  mode,
  meetingTitle = 'Meeting',
  onConfirm,
}: MeetingScopeDialogProps) {
  const [selectedScope, setSelectedScope] = useState<RecurrenceScope>('occurrence');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await onConfirm(selectedScope);
      onOpenChange(false);
    } catch (err) {
      console.error('Scope dialog error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const isCancel = mode === 'cancel';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-6 rounded-2xl bg-card border-border/80 shadow-2xl">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
            {isCancel ? 'Cancel Recurring Meeting' : 'Edit Recurring Meeting'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {isCancel
              ? `Select which occurrences of "${meetingTitle}" you want to cancel.`
              : `Select which occurrences of "${meetingTitle}" you want to apply changes to.`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup
            value={selectedScope}
            onValueChange={(val) => setSelectedScope(val as RecurrenceScope)}
            className="space-y-3"
          >
            {/* 1. Occurrence scope */}
            <Label
              htmlFor="scope-occurrence"
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer ${
                selectedScope === 'occurrence'
                  ? 'border-primary/60 bg-primary/5 dark:bg-primary/10 shadow-xs ring-1 ring-primary/40'
                  : 'border-border/60 hover:bg-muted/40 hover:border-border'
              }`}
            >
              <RadioGroupItem value="occurrence" id="scope-occurrence" className="mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>This meeting only</span>
                </div>
                <p className="text-xs text-muted-foreground leading-normal">
                  {isCancel
                    ? 'Only this specific occurrence will be cancelled. Future occurrences remain scheduled.'
                    : 'Changes will apply only to this specific occurrence.'}
                </p>
              </div>
            </Label>

            {/* 2. Following scope */}
            <Label
              htmlFor="scope-following"
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer ${
                selectedScope === 'following'
                  ? 'border-primary/60 bg-primary/5 dark:bg-primary/10 shadow-xs ring-1 ring-primary/40'
                  : 'border-border/60 hover:bg-muted/40 hover:border-border'
              }`}
            >
              <RadioGroupItem value="following" id="scope-following" className="mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                  <CalendarRange className="w-3.5 h-3.5 text-primary" />
                  <span>This and following meetings</span>
                </div>
                <p className="text-xs text-muted-foreground leading-normal">
                  {isCancel
                    ? 'This and all future occurrences in this series will be cancelled.'
                    : 'A new series starting from this date will receive your changes.'}
                </p>
              </div>
            </Label>

            {/* 3. Series scope */}
            <Label
              htmlFor="scope-series"
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer ${
                selectedScope === 'series'
                  ? 'border-primary/60 bg-primary/5 dark:bg-primary/10 shadow-xs ring-1 ring-primary/40'
                  : 'border-border/60 hover:bg-muted/40 hover:border-border'
              }`}
            >
              <RadioGroupItem value="series" id="scope-series" className="mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                  <Repeat className="w-3.5 h-3.5 text-primary" />
                  <span>All meetings in this series</span>
                </div>
                <p className="text-xs text-muted-foreground leading-normal">
                  {isCancel
                    ? 'All scheduled occurrences in the entire series will be cancelled.'
                    : 'Changes will apply to all future occurrences of this series.'}
                </p>
              </div>
            </Label>
          </RadioGroup>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="text-xs h-8 px-3 rounded-lg"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={submitting}
            className={`text-xs h-8 px-4 rounded-lg font-semibold gap-1.5 shadow-xs ${
              isCancel
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isCancel ? 'Confirm Cancellation' : 'Confirm Changes'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
