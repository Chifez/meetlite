import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  Video,
  Trash2,
  Play,
  Square,
  Lock,
  Globe,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Meeting } from '@/lib/types';
import { useMeetingsStore } from '@/stores/meetings-store';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { formatRecurrenceFrequency } from '@/lib/recurrence-utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface MeetingCardProps {
  meeting: Meeting;
  showJoinButton?: boolean;
}

const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  showJoinButton,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { startMeeting, completeMeeting, openDeleteDialog } =
    useMeetingsStore();

  const scheduledTime = meeting.scheduledTime || '';
  const duration = meeting.duration || 60;
  const privacy = meeting.privacy || 'public';
  const statusValue = meeting.status || 'scheduled';
  const createdBy = meeting.createdBy || '';
  const participants = meeting.participants || [];
  const userId = user?.id;

  // Compute status info
  const getDisplayStatus = () => {
    const now = new Date();
    const start = new Date(scheduledTime);
    const end = new Date(start.getTime() + duration * 60000);
    
    if (
      statusValue === 'ongoing' ||
      (statusValue === 'scheduled' && now >= start && now <= end)
    ) {
      return {
        label: 'Ongoing',
        dotColor: 'bg-green-500 shadow-[0_0_10px_#22c55e]',
        textColor: 'text-green-600 dark:text-green-400',
        pulse: true,
      };
    }
    if (statusValue === 'completed' || now > end) {
      return {
        label: 'Ended',
        dotColor: 'bg-zinc-400 dark:bg-zinc-600',
        textColor: 'text-muted-foreground',
        pulse: false,
      };
    }
    if (statusValue === 'cancelled') {
      return {
        label: 'Cancelled',
        dotColor: 'bg-red-500 shadow-[0_0_10px_#ef4444]',
        textColor: 'text-red-500',
        pulse: false,
      };
    }
    // Default: Scheduled / Not started
    return {
      label: 'Scheduled',
      dotColor: 'bg-blue-500 shadow-[0_0_10px_#3b82f6]',
      textColor: 'text-blue-500',
      pulse: false,
    };
  };

  const getTypeIcon = (type: string) => {
    const iconProps = { className: 'w-4 h-4 text-muted-foreground' };
    switch (type) {
      case 'private':
        return <Lock {...iconProps} />;
      case 'public':
        return <Globe {...iconProps} />;
      default:
        return <Calendar {...iconProps} />;
    }
  };

  const getButtonState = () => {
    const isCreator = createdBy === userId;
    const isOngoing =
      statusValue === 'ongoing' ||
      (statusValue === 'scheduled' && new Date() >= new Date(scheduledTime));
    const isCompleted =
      statusValue === 'completed' ||
      new Date() >
        new Date(new Date(scheduledTime).getTime() + duration * 60000);
    const isCancelled = statusValue === 'cancelled';

    if (isCompleted || isCancelled) {
      return { type: 'disabled', text: 'Ended', disabled: true };
    }

    if (isCreator) {
      if (isOngoing) {
        return { type: 'end', text: 'End Meeting', disabled: false };
      } else {
        return { type: 'start', text: 'Start', disabled: false };
      }
    } else {
      if (isOngoing) {
        return { type: 'join', text: 'Join', disabled: false };
      } else {
        return { type: 'disabled', text: 'Waiting...', disabled: true };
      }
    }
  };

  const statusObj = getDisplayStatus();
  const buttonState = getButtonState();
  const maxAvatars = 4;
  const visibleParticipants = participants.slice(0, maxAvatars);
  const overflowCount = participants.length - maxAvatars;
  const recurrenceFrequency = formatRecurrenceFrequency(meeting);

  const getInitials = (email: string) => {
    const cleanEmail = email.split('@')[0];
    const parts = cleanEmail.split(/[._-]/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return cleanEmail.slice(0, 2).toUpperCase();
  };

  const handleButtonClick = async () => {
    if (buttonState.disabled) return;

    try {
      if (buttonState.type === 'start') {
        const roomId = await startMeeting(meeting.meetingId);
        navigate(`/lobby/${roomId}`);
      } else if (buttonState.type === 'join') {
        try {
          const roomId = await startMeeting(meeting.meetingId);
          navigate(`/lobby/${roomId}`);
        } catch (error: any) {
          navigate(`/meeting/${meeting.meetingId}/join`);
        }
      } else if (buttonState.type === 'end') {
        await completeMeeting(meeting.meetingId);
      }
    } catch (error) {
      console.error('Meeting action failed:', error);
    }
  };

  const handleDeleteMeeting = async () => {
    if (meeting.source === 'google' && meeting.externalId) {
      openDeleteDialog(meeting.meetingId, {
        isGoogleCalendar: true,
        externalId: meeting.externalId,
      });
    } else {
      openDeleteDialog(meeting.meetingId);
    }
  };

  return (
    <div className="glass-card hover:border-primary/50 hover:shadow-md transition-all duration-300 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden group">
      
      {/* 1. Left Section: Title & Metadata */}
      <div className="flex-1 min-w-0 space-y-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Status Pulsing Dot */}
          <span className="relative flex h-2 w-2">
            {statusObj.pulse && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            )}
            <span className={cn("relative inline-flex rounded-full h-2 w-2", statusObj.dotColor)}></span>
          </span>

          <div className="flex items-center space-x-1.5 min-w-0">
            {getTypeIcon(privacy)}
            <h4 className="font-bold text-foreground truncate group-hover:text-primary transition-colors text-sm sm:text-base">
              {meeting.title}
            </h4>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {recurrenceFrequency && (
              <Badge
                variant="secondary"
                className="px-2 py-0.5 text-[10px] font-bold bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400"
              >
                {recurrenceFrequency}
              </Badge>
            )}
            {meeting.source === 'google' && (
              <Badge
                variant="secondary"
                className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400"
              >
                Google
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn("px-2 py-0.5 text-[10px] font-bold border-none bg-transparent", statusObj.textColor)}
            >
              {statusObj.label}
            </Badge>
          </div>
        </div>

        {/* Date and Time Row */}
        <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {format(new Date(scheduledTime), 'MMM dd, yyyy')} • {new Date(scheduledTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <span>•</span>
          <span>{duration} minutes duration</span>
        </div>

        {meeting.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 max-w-2xl">
            {meeting.description}
          </p>
        )}
      </div>

      {/* 2. Middle Section: Stacked Avatars */}
      {participants.length > 0 && (
        <div className="flex items-center space-x-2 shrink-0 md:justify-center">
          <span className="text-xs font-bold text-muted-foreground md:hidden">Attendees:</span>
          <div className="flex -space-x-2.5 overflow-hidden">
            {visibleParticipants.map((p, idx) => (
              <Tooltip key={p + idx}>
                <TooltipTrigger asChild>
                  <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-background text-[10px] font-bold text-primary flex items-center justify-center cursor-pointer transition-transform hover:translate-y-[-2px] hover:z-10">
                    {getInitials(p)}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="bg-popover border border-border shadow-md rounded-lg font-semibold px-2.5 py-1.5 text-xs text-foreground backdrop-blur-md">
                  {p}
                </TooltipContent>
              </Tooltip>
            ))}
            {overflowCount > 0 && (
              <div className="w-8 h-8 rounded-full bg-muted border-2 border-background text-[10px] font-bold text-muted-foreground flex items-center justify-center">
                +{overflowCount}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Right Section: Action Controls */}
      <div className="flex items-center justify-end gap-2.5 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
        {(createdBy === userId || meeting.source === 'google') && (
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 rounded-xl h-9 w-9"
            onClick={handleDeleteMeeting}
            aria-label="Delete meeting"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
        {showJoinButton && (
          <Button
            size="sm"
            onClick={handleButtonClick}
            disabled={buttonState.disabled}
            className={cn(
              "rounded-xl px-4 py-2 font-bold text-xs shadow-sm transition-all h-9 flex items-center gap-1.5",
              buttonState.disabled
                ? 'bg-muted text-muted-foreground'
                : buttonState.type === 'end'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/95'
                : 'bg-gradient-to-r from-primary to-violet-600 text-primary-foreground hover:opacity-95 shadow-md hover:shadow-lg'
            )}
          >
            {buttonState.type === 'start' ? (
              <Play className="h-3.5 w-3.5 fill-current" />
            ) : buttonState.type === 'end' ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Video className="h-3.5 w-3.5" />
            )}
            {buttonState.text}
          </Button>
        )}
      </div>

    </div>
  );
};

export default MeetingCard;
