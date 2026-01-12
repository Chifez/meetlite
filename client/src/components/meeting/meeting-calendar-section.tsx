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
      // Exclude parent recurring meetings, only show instances and regular meetings
      return !(meeting.isRecurring && !meeting.recurrenceId);
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
