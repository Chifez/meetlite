import React, { useState } from 'react';
import {
  Check,
  Calendar,
  Clock,
  Globe,
  Lock,
  Link as LinkIcon,
  Copy,
  CalendarPlus,
  Share2,
  Repeat,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getInitials } from '@/components/meeting/meeting-details-dialog';

export interface MeetingScheduledConfirmationProps {
  meeting: {
    title: string;
    description?: string;
    scheduledTime?: string | Date;
    date?: Date;
    time?: string;
    timeZone?: string;
    duration?: number;
    privacy?: 'public' | 'private';
    participants?: string[];
    roomId?: string;
    meetingId?: string;
    isRecurring?: boolean;
    recurrenceSummary?: string;
  };
  onDone: () => void;
  onViewMeetings?: () => void;
}

const AVATAR_PALETTES = [
  'bg-[#E1F5EE] text-[#085041] dark:bg-emerald-950/60 dark:text-emerald-300',
  'bg-[#FAECE7] text-[#712B13] dark:bg-orange-950/60 dark:text-orange-300',
  'bg-[#E6F1FB] text-[#0C447C] dark:bg-blue-950/60 dark:text-blue-300',
  'bg-[#EEEDFE] text-[#3C3489] dark:bg-indigo-950/60 dark:text-indigo-300',
  'bg-[#FBEAF0] text-[#72243E] dark:bg-rose-950/60 dark:text-rose-300',
];

export function MeetingScheduledConfirmation({
  meeting,
  onDone,
  onViewMeetings,
}: MeetingScheduledConfirmationProps) {
  const [copied, setCopied] = useState(false);

  const identifier = meeting.roomId || meeting.meetingId || 'abc-defg-hij';
  const meetingLink = `${window.location.origin}/lobby/${identifier}`;

  const attendees = meeting.participants || [];

  // Compute formatted date & time strings
  let dateStr = 'Today';
  let timeStr = 'Now';
  const durationMin = meeting.duration || 30;

  if (meeting.scheduledTime) {
    const d = new Date(meeting.scheduledTime);
    if (!isNaN(d.getTime())) {
      dateStr = format(d, 'EEE, MMM d');
      timeStr = format(d, 'h:mm a');
    }
  } else if (meeting.date) {
    dateStr = format(meeting.date, 'EEE, MMM d');
    if (meeting.time) {
      const [h, m] = meeting.time.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      timeStr = `${displayHour}:${String(m).padStart(2, '0')} ${ampm}`;
    }
  }

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
    const inviteText = `Join my meeting "${meeting.title}" on MeetLite\nWhen: ${dateStr} at ${timeStr} (${meeting.timeZone || 'WAT'})\nLink: ${meetingLink}`;
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

  return (
    <div className="w-full text-foreground text-[13px] leading-normal font-sans">
      {/* Success Badge & Header */}
      <div className="pt-6 pb-4 px-6 text-center">
        <div className="w-11 h-11 rounded-full bg-[#E1F5EE] dark:bg-emerald-950/70 text-[#0F6E56] dark:text-emerald-400 inline-flex items-center justify-center text-xl shadow-xs">
          <Check className="w-5 h-5 stroke-[2.5]" />
        </div>
        <h2 className="text-base font-medium mt-2.5 text-foreground">
          Meeting scheduled
        </h2>
        <p className="text-xs text-[#6B6A65] dark:text-muted-foreground mt-0.5">
          {attendees.length > 0
            ? `Invites are on their way to ${attendees.length} ${attendees.length === 1 ? 'person' : 'people'}.`
            : 'Your meeting is ready to share.'}
        </p>
      </div>

      <div className="px-6 pb-5 space-y-3">
        {/* Meeting Details Card */}
        <div className="bg-white dark:bg-card border border-[#DAD7CF] dark:border-border/80 rounded-[10px] p-3.5 shadow-2xs">
          <div className="font-medium text-sm text-foreground">
            {meeting.title || 'Untitled Meeting'}
          </div>
          <div className="text-xs text-[#6B6A65] dark:text-muted-foreground mt-1 flex gap-3 flex-wrap items-center">
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
            {meeting.isRecurring && (
              <span className="inline-flex items-center gap-1 text-primary">
                <Repeat className="w-3.5 h-3.5" /> Recurring
              </span>
            )}
          </div>
        </div>

        {/* Meeting Link Row */}
        <div>
          <label className="text-xs font-medium text-[#3A3A37] dark:text-foreground/90 block mb-1.5">
            Meeting link
          </label>
          <div className="flex gap-1.5 items-center">
            <div className="flex-1 min-w-0 h-9 bg-white dark:bg-background border border-[#CFCCC3] dark:border-border/80 rounded-lg px-2.5 flex items-center gap-2 text-xs text-[#3A3A37] dark:text-foreground">
              <LinkIcon className="w-3.5 h-3.5 text-[#6B6A65] dark:text-muted-foreground shrink-0" />
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

        {/* Invitee List (if any) */}
        {attendees.length > 0 && (
          <div className="bg-white dark:bg-card border border-[#DAD7CF] dark:border-border/80 rounded-[10px] px-3 py-1 shadow-2xs divide-y divide-[#E8E5DE] dark:divide-border/60 max-h-36 overflow-y-auto">
            {attendees.map((email, idx) => {
              const initials = getInitials(email);
              const palette = AVATAR_PALETTES[idx % AVATAR_PALETTES.length];
              return (
                <div key={idx} className="flex items-center gap-2.5 py-2">
                  <div
                    className={`w-6 h-6 rounded-full text-[10px] font-medium flex items-center justify-center shrink-0 ${palette}`}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">
                      {email.split('@')[0]}
                    </div>
                    <div className="text-[11px] text-[#6B6A65] dark:text-muted-foreground truncate">
                      {email}
                    </div>
                  </div>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#E1F5EE] dark:bg-emerald-950/60 text-[#085041] dark:text-emerald-400 shrink-0">
                    Invite sent
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Secondary Actions Grid */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddToCalendar}
            className="h-9 rounded-lg border-[#CFCCC3] dark:border-border/80 bg-white dark:bg-card text-xs font-medium gap-1.5 hover:bg-secondary/40 justify-center"
          >
            <CalendarPlus className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Add to calendar</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShareInvite}
            className="h-9 rounded-lg border-[#CFCCC3] dark:border-border/80 bg-white dark:bg-card text-xs font-medium gap-1.5 hover:bg-secondary/40 justify-center"
          >
            <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Share invite</span>
          </Button>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-t border-[#E2DFD7] dark:border-border/80 bg-[#F6F5F1] dark:bg-muted/30">
        <div className="flex-1">
          {onViewMeetings && (
            <button
              type="button"
              onClick={onViewMeetings}
              className="text-xs text-primary font-medium hover:underline focus:outline-none"
            >
              View in Meetings
            </button>
          )}
        </div>
        <Button
          type="button"
          onClick={onDone}
          className="h-8 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs shadow-xs"
        >
          Done
        </Button>
      </div>
    </div>
  );
}

export default MeetingScheduledConfirmation;

