import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, ChevronDown, MoreHorizontal, Copy, Trash2, Video, Clock, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Meeting } from '@/lib/types';
import { useCanCreateMeetings } from '@/hooks/use-permissions';
import { useWorkspace } from '@/contexts/workspace-context';
import { useMeetingsStore } from '@/stores/meetings-store';
import { format, isToday, isTomorrow, isThisWeek, differenceInMinutes } from 'date-fns';
import { toast } from 'sonner';

interface UpcomingMeetingsSectionProps {
  meetings: Meeting[];
  loading: boolean;
  onSchedule: () => void;
}

type FilterTab = 'today' | 'tomorrow' | 'week';

// Soft pastel palette for avatar badges
const AVATAR_COLORS = [
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
];

function getInitials(nameOrEmail: string): string {
  if (!nameOrEmail) return 'U';
  if (nameOrEmail.includes('@')) {
    return nameOrEmail.slice(0, 2).toUpperCase();
  }
  const parts = nameOrEmail.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

export default function UpcomingMeetingsSection({
  meetings,
  loading,
  onSchedule,
}: UpcomingMeetingsSectionProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('today');
  const { currentWorkspaceName } = useWorkspace();
  const canCreateMeetings = useCanCreateMeetings();
  const { openDeleteDialog, startMeeting } = useMeetingsStore();
  const navigate = useNavigate();

  // Filter meetings based on active tab
  const filteredMeetings = useMemo(() => {
    return meetings.filter((meeting) => {
      const date = new Date(meeting.scheduledTime);
      if (isNaN(date.getTime())) return false;
      if (activeTab === 'today') return isToday(date);
      if (activeTab === 'tomorrow') return isTomorrow(date);
      if (activeTab === 'week') return isThisWeek(date);
      return true;
    });
  }, [meetings, activeTab]);

  const handleCopyLink = (meeting: Meeting) => {
    const url = `${window.location.origin}/lobby/${meeting.roomId || meeting.meetingId}`;
    navigator.clipboard.writeText(url);
    toast.success('Meeting link copied to clipboard');
  };

  const handleJoin = (meeting: Meeting) => {
    if (meeting.status === 'scheduled') {
      startMeeting(meeting.meetingId);
    }
    navigate(`/lobby/${meeting.roomId || meeting.meetingId}`);
  };

  return (
    <div className="bg-card border border-border/80 rounded-2xl shadow-2xs overflow-hidden">
      {/* Header bar with Today / Tomorrow / This week tabs */}
      <div className="p-4 sm:px-5 border-b border-border/60 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Upcoming Meetings
        </h2>

        {/* Tab Filters */}
        <div className="flex items-center gap-1 bg-surface-sunken/80 p-0.5 rounded-lg border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
              activeTab === 'today'
                ? 'bg-card text-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tomorrow')}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
              activeTab === 'tomorrow'
                ? 'bg-card text-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('week')}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
              activeTab === 'week'
                ? 'bg-card text-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            This week
          </button>
        </div>
      </div>

      {/* Meeting Rows */}
      {loading ? (
        <div className="py-12 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
          <p className="text-xs text-muted-foreground mt-2 font-medium">Loading meetings...</p>
        </div>
      ) : filteredMeetings.length === 0 ? (
        // Compact 80px empty state matching Claude design
        <div className="px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-sunken flex items-center justify-center shrink-0 border border-border/60 text-muted-foreground">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                No meetings scheduled {activeTab === 'today' ? 'today' : activeTab === 'tomorrow' ? 'tomorrow' : 'this week'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Book a meeting slot to invite collaborators.
              </p>
            </div>
          </div>
          {canCreateMeetings && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSchedule}
              className="h-8 px-3 text-xs font-semibold rounded-lg border-border/80 hover:bg-surface-sunken"
            >
              Schedule meeting
            </Button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {filteredMeetings.slice(0, 5).map((meeting) => {
            const scheduledDate = new Date(meeting.scheduledTime);
            const timeStr = !isNaN(scheduledDate.getTime())
              ? format(scheduledDate, 'HH:mm')
              : '--:--';

            const now = new Date();
            const minutesUntil = differenceInMinutes(scheduledDate, now);
            const isLive = meeting.status === 'ongoing' || (minutesUntil <= 0 && minutesUntil >= -(meeting.duration || 45));
            const isStartingSoon = minutesUntil > 0 && minutesUntil <= 30;

            const participantsList = [
              ...(meeting.participants || []),
              ...(meeting.invites?.map((i) => i.email) || []),
            ];
            const visibleAvatars = participantsList.slice(0, 2);
            const overflowCount = participantsList.length - visibleAvatars.length;

            return (
              <div
                key={meeting.meetingId}
                className="py-3 px-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors group"
              >
                {/* Left: Time and Meeting Info */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <span className="text-xs font-semibold text-muted-foreground font-mono w-11 sm:w-12 shrink-0">
                    {timeStr}
                  </span>

                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {meeting.title || 'Untitled Meeting'}
                    </h3>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {meeting.duration || 45} min · {currentWorkspaceName || 'Personal Account'}
                    </p>
                  </div>
                </div>

                {/* Right: Avatars, Status Badge, and Join/Details Button */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  {/* Overlapping Avatar Stack */}
                  {participantsList.length > 0 && (
                    <div className="hidden sm:flex items-center -space-x-1.5 mr-1">
                      {visibleAvatars.map((participant, pIdx) => {
                        const colorClass = AVATAR_COLORS[pIdx % AVATAR_COLORS.length];
                        return (
                          <div
                            key={pIdx}
                            className={`w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-bold ${colorClass}`}
                            title={participant}
                          >
                            {getInitials(participant)}
                          </div>
                        );
                      })}
                      {overflowCount > 0 && (
                        <div className="w-6 h-6 rounded-full border-2 border-card bg-surface-sunken text-muted-foreground flex items-center justify-center text-[9px] font-bold">
                          +{overflowCount}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status Pill */}
                  {isLive ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Live
                    </span>
                  ) : isStartingSoon ? (
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                      In {minutesUntil} min
                    </span>
                  ) : null}

                  {/* Primary CTA (Join or Details) */}
                  {isLive || isStartingSoon ? (
                    <Button
                      size="sm"
                      onClick={() => handleJoin(meeting)}
                      className="h-7 px-3 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
                    >
                      Join
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleJoin(meeting)}
                      className="h-7 px-3 text-xs font-medium rounded-lg border-border/80 text-foreground hover:bg-surface-sunken"
                    >
                      Details
                    </Button>
                  )}

                  {/* Actions Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 text-xs">
                      <DropdownMenuItem onClick={() => handleCopyLink(meeting)} className="gap-2">
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Link</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => openDeleteDialog(meeting.meetingId)}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Expander linking to full Meetings view */}
      {filteredMeetings.length > 0 && (
        <div className="py-2.5 flex justify-center border-t border-border/50 bg-card/60">
          <button
            type="button"
            onClick={() => navigate('/meetings')}
            className="w-7 h-7 rounded-full border border-border/80 bg-card hover:bg-surface-sunken flex items-center justify-center text-muted-foreground hover:text-foreground shadow-2xs transition-all cursor-pointer"
            title="View all meetings"
            aria-label="View all meetings"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
