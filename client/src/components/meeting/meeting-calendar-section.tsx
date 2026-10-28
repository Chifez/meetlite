import MeetingCalendar from '@/components/meeting/meeting-calendar';
import { Meeting } from '@/lib/types';
import { useMemo } from 'react';

export default function MeetingCalendarSection({
  meetings,
  loading,
}: {
  meetings: Meeting[];
  loading: boolean;
  userId?: string;
}) {
  const filteredMeetings = useMemo(() => {
    return meetings.filter((meeting) => {
      // Exclude series templates (which are non-joinable templates), only show joinable occurrences and single meetings
      const isSeriesTemplate =
        Boolean(meeting.seriesId && !meeting.occurrenceKey) ||
        Boolean(meeting.isRecurring && !meeting.recurrenceId && !meeting.parentRecurrenceId);
      return !isSeriesTemplate;
    });
  }, [meetings]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground mt-2">Loading meetings...</p>
      </div>
    );
  }
  return <MeetingCalendar meetings={filteredMeetings} onEventClick={() => {}} />;
}
