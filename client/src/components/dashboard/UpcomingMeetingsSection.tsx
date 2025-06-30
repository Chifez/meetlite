import { List, Calendar, PlusCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import MeetingCard from '@/components/meeting/MeetingCard';
import { Meeting } from '@/lib/types';

export default function UpcomingMeetingsSection({
  meetings,
  loading,
  onStartMeeting,
  onDeleteMeeting,
  onJoinMeeting,
  onEndMeeting,
  userId,
  onSchedule,
}: {
  meetings: Meeting[];
  loading: boolean;
  onStartMeeting: (id: string) => void;
  onDeleteMeeting: (id: string) => void;
  onJoinMeeting: (id: string) => void;
  onEndMeeting: (id: string) => void;
  userId?: string;
  onSchedule: () => void;
}) {
  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <List className="h-6 w-6 text-blue-600" /> Upcoming Meetings
      </h2>
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading meetings...</p>
          </div>
        ) : meetings.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  No upcoming meetings
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Schedule your first meeting to get started with your team
                  collaboration.
                </p>
              </div>
              <Button onClick={onSchedule} className="mt-4">
                <PlusCircle className="w-4 h-4 mr-2" />
                Schedule Meeting
              </Button>
            </CardContent>
          </Card>
        ) : (
          meetings.map((meeting) => (
            <MeetingCard
              key={meeting.meetingId}
              meeting={meeting}
              userId={userId}
              onStart={onStartMeeting}
              onDelete={onDeleteMeeting}
              onJoin={onJoinMeeting}
              onEnd={onEndMeeting}
              showJoinButton={true}
            />
          ))
        )}
      </div>
    </div>
  );
}
