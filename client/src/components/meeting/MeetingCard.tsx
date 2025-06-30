import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Calendar,
  Clock,
  Video,
  Trash2,
  Play,
  Square,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Meeting } from '@/lib/types';

interface MeetingCardProps {
  meeting: Meeting;
  userId?: string;
  onStart: (meetingId: string) => void;
  onDelete: (meetingId: string) => void;
  onJoin?: (meetingId: string) => void;
  onEnd?: (meetingId: string) => void;
  showJoinButton?: boolean;
}

const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  userId,
  onStart,
  onDelete,
  onJoin,
  onEnd,
  showJoinButton,
}) => {
  // Fallbacks for imported events
  const scheduledTime = meeting.scheduledTime || '';
  const duration = meeting.duration || 60;
  const privacy = meeting.privacy || 'public';
  const statusValue = meeting.status || 'scheduled';
  const createdBy = meeting.createdBy || '';
  const participants = meeting.participants || [];

  // Compute display status
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
        color:
          'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300',
      };
    }
    if (statusValue === 'completed' || now > end) {
      return {
        label: 'Completed',
        color:
          'bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-300',
      };
    }
    if (statusValue === 'cancelled') {
      return {
        label: 'Cancelled',
        color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
      };
    }
    // Default: upcoming
    return {
      label: 'Upcoming',
      color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
    };
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'private':
        return '🔒';
      case 'public':
        return '🌐';
      default:
        return '📅';
    }
  };

  // Determine button state based on user role and meeting status
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
      return { type: 'disabled', text: 'Meeting Ended', disabled: true };
    }

    if (isCreator) {
      if (isOngoing) {
        return { type: 'end', text: 'End Meeting', disabled: false };
      } else {
        return { type: 'start', text: 'Start', disabled: false };
      }
    } else {
      // Not creator (invited user)
      if (isOngoing) {
        return { type: 'join', text: 'Join', disabled: false };
      } else {
        return { type: 'disabled', text: 'Waiting for Host', disabled: true };
      }
    }
  };

  const statusObj = getDisplayStatus();
  const buttonState = getButtonState();
  const maxParticipantsToShow = 3;
  const visibleParticipants = participants.slice(0, maxParticipantsToShow);
  const overflowCount = participants.length - maxParticipantsToShow;

  const handleButtonClick = () => {
    if (buttonState.disabled) return;

    if (buttonState.type === 'start') {
      onStart(meeting.meetingId);
    } else if (buttonState.type === 'join') {
      onJoin?.(meeting.meetingId);
    } else if (buttonState.type === 'end') {
      onEnd?.(meeting.meetingId);
    }
  };

  return (
    <Card className="group hover:shadow-md transition-all duration-300 border-l-4 border-l-indigo-500">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm flex-shrink-0">
                  {getTypeIcon(privacy)}
                </span>
                <h4 className="font-medium text-foreground group-hover:text-indigo-600 transition-colors text-sm sm:text-base truncate">
                  {meeting.title}
                </h4>
                {meeting.source === 'google' && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-xs font-medium border border-blue-100">
                    Google
                  </span>
                )}
                {meeting.source === 'outlook' && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-green-50 text-green-700 text-xs font-medium border border-green-100">
                    Outlook
                  </span>
                )}
              </div>
              <span
                className={`md:hidden px-2 py-1 rounded-full text-xs font-medium ${statusObj.color}`}
              >
                {statusObj.label}
              </span>
            </div>
            <div className="flex items-center justify-between md:grid md:grid-cols-4 gap-1 md:gap-2 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span className="text-nowrap">
                  {format(new Date(scheduledTime), 'MMM,dd yyyy')}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span>
                  {new Date(scheduledTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="h-3 w-3 flex-shrink-0" />
                <span>{participants.length}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span>{duration} min</span>
              </div>
            </div>
            {/* Participants badges */}
            {participants.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="text-[14px] font-semibold">participants:</span>{' '}
                {visibleParticipants.map((p, idx) => (
                  <Badge
                    key={p + idx}
                    variant="secondary"
                    className="truncate max-w-[300px]"
                  >
                    {p}
                  </Badge>
                ))}
                {overflowCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-muted text-muted-foreground"
                  >
                    +{overflowCount} more
                  </Badge>
                )}
              </div>
            )}
            {meeting.description && (
              <div className="text-xs text-muted-foreground line-clamp-2">
                {meeting.description}
              </div>
            )}
          </div>
          {/* Status, Action button, and Delete icon column */}
          <div className="flex flex-col items-end gap-2">
            <span
              className={`hidden md:block px-2 py-1 rounded-full text-xs font-medium ${statusObj.color}`}
            >
              {statusObj.label}
            </span>
            <span className="flex items-center gap-1">
              {onDelete && createdBy === userId && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(meeting.meetingId)}
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
                  variant={
                    buttonState.disabled
                      ? 'secondary'
                      : buttonState.type === 'end'
                      ? 'destructive'
                      : 'default'
                  }
                >
                  {buttonState.type === 'start' ? (
                    <Play className="h-3 w-3 mr-1" />
                  ) : buttonState.type === 'end' ? (
                    <Square className="h-3 w-3 mr-1" />
                  ) : (
                    <Video className="h-3 w-3 mr-1" />
                  )}
                  {buttonState.text}
                </Button>
              )}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MeetingCard;
