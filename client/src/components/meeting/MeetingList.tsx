import MeetingCard from './MeetingCard';
import { Loader2, CalendarDays } from 'lucide-react';

export default function MeetingList({
  meetings,
  loading,
  userId,
  onStartMeeting,
  onDelete,
}: {
  meetings: any[];
  loading: boolean;
  userId?: string;
  onStartMeeting: (meetingId: string) => void;
  onDelete: (meetingId: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }
  if (meetings.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        <CalendarDays className="mx-auto h-10 w-10 mb-2 text-blue-300" />
        No meetings scheduled yet.
        <br />
        Click "Schedule Meeting" to get started.
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {meetings.map((meeting) => (
        <MeetingCard
          key={meeting.meetingId}
          meeting={meeting}
          userId={userId}
          onStart={onStartMeeting}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
