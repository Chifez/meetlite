import { useState, useMemo } from 'react';
import {
  Calendar,
  MoreHorizontal,
  Copy,
  Trash2,
  Lock,
  Search,
  Square,
  Play,
  Video,
  CalendarPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Meeting } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/contexts/workspace-context';
import MeetingDetailsDialog from '@/components/meeting/meeting-details-dialog';
import { useMeetingController } from '@/features/meetings/meeting-controller';
import {
  primaryMeetingAction,
  extractMeetingParticipants,
  getInitials,
  formatMeetingTime,
  formatMeetingDate,
  AVATAR_COLORS,
} from '@/features/meetings/meeting-view-state';

interface MeetingListSectionProps {
  meetings: Meeting[];
  loading: boolean;
  onSchedule?: () => void;
}

type TabFilter = 'all' | 'today' | 'this_week' | 'upcoming';

export default function MeetingListSection({
  meetings,
  loading,
  onSchedule,
}: MeetingListSectionProps) {
  const { user } = useAuth();
  const { currentWorkspaceName } = useWorkspace();

  const {
    handleAction,
    openDetails,
    closeDetails,
    detailsMeeting,
    handleCopyLink,
    handleDelete,
    handleEndMeeting,
  } = useMeetingController();

  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter meetings by search query
  const searchedMeetings = useMemo(() => {
    let list = [...meetings].filter((m) => {
      // Exclude series templates (which are non-joinable), keep joinable occurrences and standalone meetings
      const isSeriesTemplate =
        Boolean(m.seriesId && !m.occurrenceKey) ||
        Boolean(m.isRecurring && !m.parentRecurrenceId && !m.recurrenceId && !m.occurrenceKey);
      return !isSeriesTemplate;
    });
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          (m.title || '').toLowerCase().includes(q) ||
          (m.description || '').toLowerCase().includes(q)
      );
    }
    // Sort chronologically
    return list.sort(
      (a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
    );
  }, [meetings, searchQuery]);

  // Group meetings into categories: Today, This Week, Later
  const groupedMeetings = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(startOfToday.getDate() + (7 - startOfToday.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);

    const todayList: Meeting[] = [];
    const thisWeekList: Meeting[] = [];
    const laterList: Meeting[] = [];

    searchedMeetings.forEach((meeting) => {
      const scheduledTime = new Date(meeting.scheduledTime);
      if (isNaN(scheduledTime.getTime())) return;

      if (scheduledTime >= startOfToday && scheduledTime <= endOfToday) {
        todayList.push(meeting);
      } else if (scheduledTime > endOfToday && scheduledTime <= endOfWeek) {
        thisWeekList.push(meeting);
      } else {
        laterList.push(meeting);
      }
    });

    return { todayList, thisWeekList, laterList };
  }, [searchedMeetings]);

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-xs font-medium text-muted-foreground">Loading meetings...</p>
      </div>
    );
  }

  // Determine which sections to render based on activeTab
  const renderSections = () => {
    const { todayList, thisWeekList, laterList } = groupedMeetings;

    if (searchedMeetings.length === 0) {
      return (
        <div className="bg-card border border-border/80 rounded-2xl py-12 sm:py-16 px-6 text-center flex flex-col items-center justify-center shadow-2xs">
          {/* Empty Icon */}
          <div className="w-12 h-12 rounded-2xl bg-surface-sunken dark:bg-muted border border-border/60 flex items-center justify-center text-muted-foreground mb-3.5">
            <Calendar className="w-6 h-6 stroke-[1.75]" />
          </div>

          {/* Header & Subtext */}
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-sm font-semibold text-foreground">
              {searchQuery ? 'No meetings match your search' : 'No upcoming meetings scheduled'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {searchQuery
                ? 'Try searching with a different title or keyword.'
                : 'Book a meeting slot to invite collaborators and start calls.'}
            </p>
          </div>

          {/* Schedule Meeting Button */}
          {onSchedule && !searchQuery && (
            <Button
              size="sm"
              onClick={onSchedule}
              className="mt-4 h-8.5 px-4 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs gap-1.5 cursor-pointer"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>Schedule meeting</span>
            </Button>
          )}
        </div>
      );
    }

    const sections = [];

    if ((activeTab === 'all' || activeTab === 'today') && todayList.length > 0) {
      sections.push({ title: 'TODAY', items: todayList });
    }

    if ((activeTab === 'all' || activeTab === 'this_week') && thisWeekList.length > 0) {
      sections.push({ title: 'THIS WEEK', items: thisWeekList });
    }

    if ((activeTab === 'all' || activeTab === 'upcoming') && laterList.length > 0) {
      sections.push({ title: 'LATER & UPCOMING', items: laterList });
    }

    if (sections.length === 0) {
      return (
        <div className="bg-card border border-border/80 rounded-2xl p-8 text-center space-y-2 shadow-2xs">
          <p className="text-xs font-medium text-muted-foreground">
            No meetings found in this view.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {sections.map((sec) => (
          <div
            key={sec.title}
            className="bg-card border border-border/80 rounded-2xl shadow-2xs overflow-hidden"
          >
            {/* Section Header */}
            <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between bg-surface-sunken/30">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {sec.title}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {sec.items.length} {sec.items.length === 1 ? 'meeting' : 'meetings'}
              </span>
            </div>

            {/* Meeting Agenda Rows */}
            <div className="divide-y divide-border/60">
              {sec.items.map((meeting) => {
                const timeStr = formatMeetingTime(meeting.scheduledTime);
                const dateStr = formatMeetingDate(meeting.scheduledTime);

                const isHost = meeting.createdBy === user?.id;
                const isLive = meeting.status === 'ongoing' || Boolean(meeting.roomId && meeting.status !== 'completed');
                const action = primaryMeetingAction(meeting, { currentUserId: user?.id });

                const participantsList = extractMeetingParticipants(meeting);
                const visibleAvatars = participantsList.slice(0, 3);
                const overflowCount = participantsList.length - visibleAvatars.length;

                return (
                  <div
                    key={meeting.meetingId}
                    className="py-3.5 px-4 sm:px-5 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors group"
                  >
                    {/* Left: Time and Date Column + Title & Metadata */}
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      {/* Scheduled Time and Date Underneath */}
                      <div className="w-16 sm:w-20 shrink-0 space-y-0.5">
                        <span className="text-xs font-semibold text-foreground font-mono block">
                          {timeStr}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium block truncate">
                          {dateStr}
                        </span>
                      </div>

                      {/* Title & metadata */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => openDetails(meeting)}
                            className="text-xs sm:text-sm font-semibold text-foreground truncate hover:text-primary transition-colors text-left cursor-pointer"
                          >
                            {meeting.title || 'Untitled Meeting'}
                          </button>

                          {meeting.privacy === 'private' && (
                            <span title="Private Meeting" className="text-muted-foreground shrink-0">
                              <Lock className="w-3 h-3" />
                            </span>
                          )}

                          {meeting.source === 'google' && (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 font-medium border-border/80 text-muted-foreground rounded"
                            >
                              Google
                            </Badge>
                          )}
                        </div>

                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {meeting.duration || 30} min · {currentWorkspaceName || 'Personal Account'}
                          {meeting.description && ` · ${meeting.description}`}
                        </p>
                      </div>
                    </div>

                    {/* Right: Avatars, Status Pill, and Actions */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      {/* Avatar Stack for invited & direct participants */}
                      {participantsList.length > 0 && (
                        <div className="flex items-center -space-x-1.5 mr-1">
                          {visibleAvatars.map((p, pIdx) => {
                            const colorClass = AVATAR_COLORS[pIdx % AVATAR_COLORS.length];
                            return (
                              <div
                                key={pIdx}
                                className={`w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-bold ${colorClass}`}
                                title={p}
                              >
                                {getInitials(p)}
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
                          Ongoing
                        </span>
                      ) : (
                        <span className="hidden sm:inline-block text-[11px] font-medium text-muted-foreground">
                          Scheduled
                        </span>
                      )}

                      {/* Main Action Button guarded by server capabilities */}
                      {isLive && isHost ? (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleAction(meeting, { kind: 'join', label: 'Join' })}
                            className="h-7 px-3 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
                          >
                            Join
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleEndMeeting(meeting)}
                            className="h-7 px-2.5 text-xs font-semibold rounded-lg gap-1 shadow-2xs"
                            title="End for all participants"
                          >
                            <Square className="w-3 h-3 fill-current" />
                            <span className="hidden md:inline">End</span>
                          </Button>
                        </div>
                      ) : action.kind === 'start' ? (
                        <Button
                          size="sm"
                          onClick={() => handleAction(meeting, action)}
                          className="h-7 px-3 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
                        >
                          Start
                        </Button>
                      ) : action.kind === 'join' ? (
                        <Button
                          size="sm"
                          onClick={() => handleAction(meeting, action)}
                          className="h-7 px-3 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
                        >
                          Join
                        </Button>
                      ) : action.kind === 'disabled' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="h-7 px-3 text-xs font-medium rounded-lg border-border/80 text-muted-foreground opacity-75"
                        >
                          {action.label}
                        </Button>
                      ) : action.kind === 'recap' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(meeting, action)}
                          className="h-7 px-3 text-xs font-medium rounded-lg border-border/80 text-foreground hover:bg-surface-sunken"
                        >
                          Recap
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDetails(meeting)}
                          className="h-7 px-3 text-xs font-medium rounded-lg border-border/80 text-foreground hover:bg-surface-sunken"
                        >
                          Details
                        </Button>
                      )}

                      {/* Actions Menu */}
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
                          <DropdownMenuItem onClick={() => openDetails(meeting)} className="gap-2">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                            <span>View Details</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopyLink(meeting)} className="gap-2">
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy Link</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(meeting)}
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
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Tabs Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Tab Filters */}
        <div className="flex items-center gap-1 bg-surface-sunken/80 p-0.5 rounded-lg border border-border/60 self-start">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-card text-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
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
            onClick={() => setActiveTab('this_week')}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
              activeTab === 'this_week'
                ? 'bg-card text-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
              activeTab === 'upcoming'
                ? 'bg-card text-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Upcoming
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-60">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search meetings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-3 text-xs rounded-xl bg-card border-border/80 text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
      </div>

      {/* Render Categorized Meeting Groups */}
      {renderSections()}

      {/* Meeting Details Dialog */}
      <MeetingDetailsDialog
        meeting={detailsMeeting}
        open={!!detailsMeeting}
        onOpenChange={(open) => !open && closeDetails()}
        onJoin={(m) => handleAction(m)}
        onDelete={(m) => handleDelete(m)}
      />
    </div>
  );
}
