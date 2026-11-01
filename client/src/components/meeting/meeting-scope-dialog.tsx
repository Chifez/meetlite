import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Calendar,
  CalendarRange,
  Repeat,
  X,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const options: Array<{
    scope: RecurrenceScope;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      scope: 'occurrence',
      title: 'This meeting only',
      description: isCancel
        ? 'Only this specific occurrence will be cancelled. Future occurrences remain.'
        : 'Changes will apply only to this specific occurrence.',
      icon: Calendar,
    },
    {
      scope: 'following',
      title: 'This and following meetings',
      description: isCancel
        ? 'This and all future occurrences in this series will be cancelled.'
        : 'A new series starting from this date will receive your changes.',
      icon: CalendarRange,
    },
    {
      scope: 'series',
      title: 'All meetings in this series',
      description: isCancel
        ? 'All scheduled occurrences in the entire series will be cancelled.'
        : 'Changes will apply to all past and future occurrences.',
      icon: Repeat,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[440px] p-0 gap-0 overflow-hidden border border-[#DAD7CF] dark:border-border/80 rounded-[14px] bg-[#FBFAF8] dark:bg-card shadow-xl text-foreground text-[13px] leading-normal font-sans"
      >
        {/* Header Bar */}
        <div className="flex items-center gap-2 px-5 pt-3.5 pb-2.5">
          <div className="w-5 h-5 flex items-center justify-center text-primary shrink-0">
            {isCancel ? (
              <AlertTriangle className="w-4.5 h-4.5 text-destructive" />
            ) : (
              <Repeat className="w-4.5 h-4.5 text-primary" />
            )}
          </div>
          <div className="text-sm font-medium flex-1 text-foreground">
            {isCancel ? 'Cancel recurring meeting' : 'Edit recurring meeting'}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-[#6B6A65] hover:text-foreground focus:outline-none p-1 rounded-md"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description Note */}
        <div className="px-5 pb-3">
          <p className="text-xs text-[#6B6A65] dark:text-muted-foreground leading-relaxed">
            {isCancel
              ? `Select which occurrences of "${meetingTitle}" you want to cancel.`
              : `Select which occurrences of "${meetingTitle}" you want to apply changes to.`}
          </p>
        </div>

        {/* Grouped Options Card */}
        <div className="px-5 pb-4">
          <div className="bg-white dark:bg-background border border-[#DAD7CF] dark:border-border/80 rounded-[10px] overflow-hidden divide-y divide-[#E8E5DE] dark:divide-border/60">
            {options.map((opt) => {
              const isSelected = selectedScope === opt.scope;
              const Icon = opt.icon;
              return (
                <div
                  key={opt.scope}
                  onClick={() => setSelectedScope(opt.scope)}
                  className={cn(
                    'flex items-center gap-2.5 p-2.5 px-3 cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-primary/5 dark:bg-primary/10'
                      : 'hover:bg-secondary/30'
                  )}
                >
                  <div className="w-7 h-7 rounded-lg bg-[#EEEDE8] dark:bg-muted flex items-center justify-center text-[#5F5E5A] dark:text-muted-foreground shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs text-foreground">
                      {opt.title}
                    </div>
                    <div className="text-[11px] text-[#6B6A65] dark:text-muted-foreground leading-normal">
                      {opt.description}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all',
                      isSelected
                        ? 'border-primary bg-primary'
                        : 'border-[#B4B2A9] bg-transparent'
                    )}
                  >
                    {isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#E2DFD7] dark:border-border/80 bg-[#F6F5F1] dark:bg-muted/30">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="h-8 px-3 rounded-lg border-[#CFCCC3] dark:border-border/80 bg-white dark:bg-card text-xs font-medium"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={submitting}
            className={cn(
              'h-8 px-3.5 rounded-lg font-medium text-xs shadow-xs gap-1.5',
              isCancel
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
            <span>{isCancel ? 'Cancel occurrences' : 'Save changes'}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MeetingScopeDialog;
