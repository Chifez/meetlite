import { Calendar } from 'lucide-react';
import MeetingCard from './MeetingCard';
import { Meeting } from '@/lib/types';

export default function MeetingListSection({
  meetings,
  loading,
}: {
  meetings: Meeting[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground mt-2">Loading meetings...</p>
      </div>
    );
  }
  if (meetings.length === 0) {
    return (
      <div className="text-center space-y-6 py-12 text-muted-foreground">
        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
          <Calendar className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            No meetings found
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            All your meetings will appear here. Start by scheduling a meeting
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {meetings.map((meeting) => (
        <MeetingCard
          key={meeting.meetingId}
          meeting={meeting}
          showJoinButton={true}
        />
      ))}
    </div>
  );
}
