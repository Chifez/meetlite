import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
  CalendarPlus,
  Share2,
  Repeat,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { Meeting } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Soft pastel palette for avatar badges
const AVATAR_PALETTES = [
  'bg-[#E1F5EE] text-[#085041] dark:bg-emerald-950/60 dark:text-emerald-300',
  'bg-[#FAECE7] text-[#712B13] dark:bg-orange-950/60 dark:text-orange-300',
  'bg-[#E6F1FB] text-[#0C447C] dark:bg-blue-950/60 dark:text-blue-300',
  'bg-[#EEEDFE] text-[#3C3489] dark:bg-indigo-950/60 dark:text-indigo-300',
  'bg-[#FBEAF0] text-[#72243E] dark:bg-rose-950/60 dark:text-rose-300',
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
  const dateStr = isValidDate ? format(scheduledDate, 'EEE, MMM d, yyyy') : 'Date not set';
  const timeStr = isValidDate ? format(scheduledDate, 'h:mm a') : '--:--';
  const durationMin = meeting.duration || 30;

  const identifier = meeting.roomId || meeting.meetingId || '';
  const meetingLink = `${window.location.origin}/lobby/${identifier}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetingLink);
    setCopied(true);
    toast.success('Meeting link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddToCalendar = () => {
    const title = encodeURIComponent(meeting.title || 'MeetLite Meeting');
    const details = encodeURIComponent(
      `${meeting.description || ''}\n\nJoin meeting: ${meetingLink}`
    );
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${encodeURIComponent(meetingLink)}`;
    window.open(googleCalendarUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareInvite = async () => {
    const inviteText = `Join my meeting "${meeting.title}" on MeetLite\nWhen: ${dateStr} at ${timeStr}\nLink: ${meetingLink}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: meeting.title,
          text: inviteText,
          url: meetingLink,
        });
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }
    navigator.clipboard.writeText(inviteText);
    toast.success('Formatted invite copied to clipboard');
  };

  const invitees = extractMeetingParticipants(meeting);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[440px] p-0 gap-0 overflow-hidden border border-[#DAD7CF] dark:border-border/80 rounded-[14px] bg-[#FBFAF8] dark:bg-card shadow-xl text-foreground text-[13px] leading-normal font-sans"
      >
        {/* Header Bar */}
        <div className="flex items-center gap-2 px-5 pt-3.5 pb-2.5">
          <div className="w-5 h-5 flex items-center justify-center text-primary shrink-0">
            {meeting.status === 'ongoing' ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            ) : (
              <Calendar className="w-4.5 h-4.5" />
            )}
          </div>
          <div className="text-sm font-medium flex-1 text-foreground">
            Meeting details
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

        {/* Content Body */}
        <div className="px-5 pb-4 space-y-3">
          {/* Meeting Summary Card */}
          <div className="bg-white dark:bg-background border border-[#DAD7CF] dark:border-border/80 rounded-[10px] p-3.5 shadow-2xs">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-sm text-foreground">
                {meeting.title || 'Untitled Meeting'}
              </div>
              {meeting.status === 'ongoing' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live
                </span>
              )}
            </div>

            <div className="text-xs text-[#6B6A65] dark:text-muted-foreground mt-1.5 flex gap-3 flex-wrap items-center">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {dateStr}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {timeStr} · {durationMin} min
              </span>
              <span className="inline-flex items-center gap-1">
                {meeting.privacy === 'private' ? (
                  <>
                    <Lock className="w-3.5 h-3.5" /> Private
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5" /> Public
                  </>
                )}
              </span>
              {(meeting.isRecurring || meeting.seriesId) && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Repeat className="w-3.5 h-3.5" /> Recurring
                </span>
              )}
            </div>

            {meeting.description && (
              <p className="text-xs text-[#5F5E5A] dark:text-muted-foreground mt-2.5 pt-2 border-t border-[#E8E5DE] dark:border-border/60 leading-relaxed">
                {meeting.description}
              </p>
            )}
          </div>

          {/* Meeting Link Row */}
          <div>
            <label className="text-xs font-medium text-[#3A3A37] dark:text-foreground/90 block mb-1.5">
              Meeting link
            </label>
            <div className="flex gap-1.5 items-center">
              <div className="flex-1 min-w-0 h-9 bg-white dark:bg-background border border-[#CFCCC3] dark:border-border/80 rounded-lg px-2.5 flex items-center gap-2 text-xs text-[#3A3A37] dark:text-foreground">
                <ExternalLink className="w-3.5 h-3.5 text-[#6B6A65] dark:text-muted-foreground shrink-0" />
                <span className="truncate select-all font-mono text-[12px]">
                  {meetingLink.replace(/^https?:\/\//, '')}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="h-9 px-3 rounded-lg border-[#CFCCC3] dark:border-border/80 bg-white dark:bg-card text-xs font-medium gap-1.5 hover:bg-secondary/40 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
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

          {/* Invited Participants List */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#3A3A37] dark:text-foreground/90">
                Participants ({invitees.length})
              </label>
            </div>

            {invitees.length === 0 ? (
              <div className="bg-white dark:bg-background border border-[#DAD7CF] dark:border-border/80 rounded-[10px] p-2.5 text-xs text-[#6B6A65] dark:text-muted-foreground text-center italic">
                No external participants invited yet.
              </div>
            ) : (
              <div className="bg-white dark:bg-background border border-[#DAD7CF] dark:border-border/80 rounded-[10px] px-3 py-1 shadow-2xs divide-y divide-[#E8E5DE] dark:divide-border/60 max-h-36 overflow-y-auto">
                {invitees.map((email, idx) => {
                  const initials = getInitials(email);
                  const palette = AVATAR_PALETTES[idx % AVATAR_PALETTES.length];
                  return (
                    <div key={idx} className="flex items-center gap-2.5 py-1.5">
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full text-[10px] font-medium flex items-center justify-center shrink-0',
                          palette
                        )}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">
                          {email.includes('@') ? email.split('@')[0] : email}
                        </div>
                        {email.includes('@') && (
                          <div className="text-[11px] text-[#6B6A65] dark:text-muted-foreground truncate">
                            {email}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#E1F5EE] dark:bg-emerald-950/60 text-[#085041] dark:text-emerald-400 shrink-0">
                        Invited
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Secondary Actions Grid */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddToCalendar}
              className="h-8.5 rounded-lg border-[#CFCCC3] dark:border-border/80 bg-white dark:bg-card text-xs font-medium gap-1.5 hover:bg-secondary/40 justify-center"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Add to calendar</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleShareInvite}
              className="h-8.5 rounded-lg border-[#CFCCC3] dark:border-border/80 bg-white dark:bg-card text-xs font-medium gap-1.5 hover:bg-secondary/40 justify-center"
            >
              <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Share invite</span>
            </Button>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[#E2DFD7] dark:border-border/80 bg-[#F6F5F1] dark:bg-muted/30">
          <div>
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onDelete(meeting);
                }}
                className="text-xs text-destructive hover:underline font-medium focus:outline-none flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3 rounded-lg border-[#CFCCC3] dark:border-border/80 bg-white dark:bg-card text-xs font-medium"
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
                className="h-8 px-3.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs shadow-xs gap-1.5"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{meeting.status === 'ongoing' ? 'Join live' : 'Start meeting'}</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
