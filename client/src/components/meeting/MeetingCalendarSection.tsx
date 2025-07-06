import MeetingCalendar from './MeetingCalendar';
import { Meeting } from '@/lib/types';

export default function MeetingCalendarSection({
  meetings,
  loading,
}: {
  meetings: Meeting[];
  loading: boolean;
  userId?: string;
}) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground mt-2">Loading meetings...</p>
      </div>
    );
  }
  return <MeetingCalendar meetings={meetings} onEventClick={() => {}} />;
}
