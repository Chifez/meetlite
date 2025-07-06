import { Meeting } from '@/lib/types';
import MeetingCard from './MeetingCard';
import { Loader2, CalendarDays } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function MeetingList({
  meetings,
  loading,
}: {
  meetings: any[];
  loading: boolean;
}) {
  const { user } = useAuth();
  const userId = user?.id;
  // Show join button for active meetings + completed meetings only for creators
  const showJoin = (m: Meeting) => {
    const meetingEnd = new Date(
      new Date(m.scheduledTime).getTime() + (m.duration || 0) * 60000
    );
    const isCreator = m.createdBy === userId;

    // Show join button if:
    // 1. Not cancelled AND
    // 2. Either not completed OR (completed but user is creator) AND
    // 3. Meeting hasn't ended yet OR (ended but user is creator)
    return (
      m.status !== 'cancelled' &&
      (m.status !== 'completed' || isCreator) &&
      (meetingEnd > new Date() || isCreator)
    );
  };

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
          showJoinButton={showJoin(meeting)}
        />
      ))}
    </div>
  );
}
