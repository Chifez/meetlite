import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import MeetingCard from '@/components/meeting/meeting-card';
import { Meeting } from '@/lib/types';
import { useMemo } from 'react';

export default function MeetingListSection({
  meetings,
  loading,
}: {
  meetings: Meeting[];
  loading: boolean;
}) {
  const filteredMeetings = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
    
    // End of the week (Sunday)
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(startOfToday.getDate() + (7 - startOfToday.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);

    const todayMeetings: Meeting[] = [];
    const thisWeekMeetings: Meeting[] = [];
    const laterMeetings: Meeting[] = [];

    // Sort all meetings chronologically first
    const sortedMeetings = [...meetings].filter(m => !m.recurrenceId).sort(
      (a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
    );

    sortedMeetings.forEach((meeting) => {
      const scheduledTime = new Date(meeting.scheduledTime);
      if (scheduledTime >= startOfToday && scheduledTime <= endOfToday) {
        todayMeetings.push(meeting);
      } else if (scheduledTime > endOfToday && scheduledTime <= endOfWeek) {
        thisWeekMeetings.push(meeting);
      } else if (scheduledTime > endOfWeek || scheduledTime < startOfToday) { // also include past meetings in later/past
        laterMeetings.push(meeting);
      }
    });

    return { todayMeetings, thisWeekMeetings, laterMeetings };
  }, [meetings]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-sm font-semibold text-ink-muted mt-3">Loading meetings...</p>
      </div>
    );
  }

  const { todayMeetings, thisWeekMeetings, laterMeetings } = filteredMeetings;
  const hasNoMeetings = todayMeetings.length === 0 && thisWeekMeetings.length === 0 && laterMeetings.length === 0;

  if (hasNoMeetings) {
    return (
      <div className="text-center space-y-4 py-16 text-muted-foreground border border-dashed border-border/80 bg-surface rounded-2xl">
        <div className="mx-auto w-12 h-12 bg-surface-sunken rounded-full flex items-center justify-center border border-border/50">
          <Calendar className="w-5 h-5 text-ink-muted" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-ink">
            No meetings scheduled
          </h3>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            Connect your calendar or schedule a new meeting to get started.
          </p>
        </div>
      </div>
    );
  }

  const renderGrid = (title: string, items: Meeting[], isFeatured = false) => {
    if (items.length === 0) return null;
    
    return (
      <div className="space-y-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
          {title}
        </h3>
        <div className="flex flex-col gap-3">
          {items.map((meeting) => (
            <MeetingCard
              key={meeting.meetingId}
              meeting={meeting}
              showJoinButton={true}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10">
      {renderGrid("Today", todayMeetings, true)}
      {renderGrid("This Week", thisWeekMeetings)}
      {renderGrid("Later", laterMeetings)}
    </div>
  );
}
