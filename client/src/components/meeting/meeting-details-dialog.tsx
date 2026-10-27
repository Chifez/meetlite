import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  Globe,
  Lock,
  Copy,
  Trash2,
  Play,
  Users,
  Video,
  ExternalLink,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';
import { Meeting } from '@/lib/types';
import { toast } from 'sonner';
import { useState } from 'react';

// Soft pastel palette for avatar badges
const AVATAR_COLORS = [
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
];

export function getInitials(nameOrEmail: string | any): string {
  if (!nameOrEmail) return 'U';
  if (typeof nameOrEmail !== 'string') {
    if (nameOrEmail.name) return getInitials(nameOrEmail.name);
    if (nameOrEmail.email) return getInitials(nameOrEmail.email);
    return 'U';
  }
  const clean = nameOrEmail.trim();
  if (clean.includes('@')) {
    const username = clean.split('@')[0];
    const parts = username.split(/[._-]/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return username.slice(0, 2).toUpperCase();
  }
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export function extractMeetingParticipants(meeting: Meeting): string[] {
  const emails: string[] = [];

  // 1. Check invites
  if (meeting.invites && Array.isArray(meeting.invites)) {
    meeting.invites.forEach((inv: any) => {
      const email = typeof inv === 'string' ? inv : inv.email;
      if (email && !emails.includes(email)) {
        emails.push(email);
      }
    });
  }

  // 2. Check participants
  if (meeting.participants && Array.isArray(meeting.participants)) {
    meeting.participants.forEach((p: any) => {
      const identifier =
        typeof p === 'string'
          ? p
          : p.email || p.user?.email || p.user?.name || p.name;
      if (identifier && !emails.includes(identifier)) {
        emails.push(identifier);
      }
    });
  }

  return emails;
}

interface MeetingDetailsDialogProps {
  meeting: Meeting | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin?: (meeting: Meeting) => void;
  onDelete?: (meeting: Meeting) => void;
}

export default function MeetingDetailsDialog({
  meeting,
  open,
  onOpenChange,
  onJoin,
  onDelete,
}: MeetingDetailsDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!meeting) return null;

  const scheduledDate = new Date(meeting.scheduledTime);
  const isValidDate = !isNaN(scheduledDate.getTime());
  const dateStr = isValidDate ? format(scheduledDate, 'EEEE, MMMM d, yyyy') : 'Date not set';
  const timeStr = isValidDate ? format(scheduledDate, 'h:mm a') : '--:--';
  const durationMin = meeting.duration || 30;

  const meetingLink = `${window.location.origin}/lobby/${meeting.roomId || meeting.meetingId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetingLink);
    setCopied(true);
    toast.success('Meeting link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const invitees = extractMeetingParticipants(meeting);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 rounded-2xl bg-card border border-border/80 shadow-lg">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="text-[11px] font-semibold uppercase tracking-wider py-0.5 px-2 rounded-md border-border/80 bg-surface-sunken text-muted-foreground gap-1"
            >
              {meeting.privacy === 'private' ? (
                <>
                  <Lock className="w-3 h-3" /> Private
                </>
              ) : (
                <>
                  <Globe className="w-3 h-3" /> Public
                </>
              )}
            </Badge>

            {meeting.status === 'ongoing' ? (
              <Badge className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold py-0.5 px-2 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5 inline-block"></span>
                Live
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[11px] font-semibold py-0.5 px-2 rounded-md text-muted-foreground border-border/80"
              >
                Scheduled
              </Badge>
            )}
          </div>

          <DialogTitle className="text-lg font-bold text-foreground font-display">
            {meeting.title || 'Untitled Meeting'}
          </DialogTitle>

          {meeting.description && (
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
              {meeting.description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Timing details */}
          <div className="bg-surface-sunken/60 rounded-xl p-3.5 border border-border/60 space-y-2">
            <div className="flex items-center gap-2.5 text-xs text-foreground font-medium">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <span>{dateStr}</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground font-medium">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>
                {timeStr} · {durationMin} minutes
              </span>
            </div>
          </div>

          {/* Meeting Link with Copy Button */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Meeting Link
            </label>
            <div className="flex items-center gap-2 bg-surface-sunken/80 border border-border/70 rounded-xl p-1.5 pl-3">
              <span className="text-xs text-foreground font-mono truncate flex-1 select-all">
                {meetingLink}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleCopyLink}
                className="h-7 px-2.5 text-xs rounded-lg gap-1.5 hover:bg-card text-foreground shrink-0 shadow-2xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Invited Participants */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Invited Participants ({invitees.length})
              </span>
            </div>

            {invitees.length === 0 ? (
              <p className="text-xs text-muted-foreground italic bg-surface-sunken/40 p-2.5 rounded-lg border border-border/40">
                No external participants invited yet.
              </p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {invitees.map((email, idx) => {
                  const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 py-1 px-2 rounded-lg hover:bg-surface-sunken/60 transition-colors"
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${colorClass}`}
                      >
                        {getInitials(email)}
                      </div>
                      <span className="text-xs text-foreground truncate flex-1">
                        {email}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 pt-4 border-t border-border/60 mt-2">
          {onDelete && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                onDelete(meeting);
              }}
              className="text-destructive hover:bg-destructive/10 text-xs h-8 px-2.5 rounded-lg gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </Button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8 px-3 rounded-lg border-border/80"
            >
              Close
            </Button>

            {onJoin && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onJoin(meeting);
                }}
                className="text-xs h-8 px-3.5 font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Join Meeting</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
