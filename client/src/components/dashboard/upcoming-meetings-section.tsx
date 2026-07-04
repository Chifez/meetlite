import { Link } from 'react-router-dom';
import { List, Calendar, PlusCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import MeetingCard from '@/components/meeting/meeting-card';
import { Meeting } from '@/lib/types';
import { useCanCreateMeetings } from '@/hooks/use-permissions';
import { useWorkspace } from '@/contexts/workspace-context';

export default function UpcomingMeetingsSection({
  meetings,
  loading,
  onSchedule,
}: {
  meetings: Meeting[];
  loading: boolean;
  onSchedule: () => void;
}) {
  const { isPersonalMode } = useWorkspace();
  const canCreateMeetings = useCanCreateMeetings();
  
  return (
    <div className="mt-10">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
          <List className="h-4.5 w-4.5 text-primary" /> Upcoming Meetings
        </h2>
        <Link to="/meetings" className="text-primary hover:underline text-xs font-semibold">
          See all meetings
        </Link>
      </div>
      
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 glass-card rounded-2xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-xs text-muted-foreground mt-3 font-semibold">
              Loading scheduled meetings...
            </p>
          </div>
        ) : meetings.length === 0 ? (
          <Card className="text-center py-14 border border-dashed border-border/80 bg-muted/10 rounded-2xl">
            <CardContent className="space-y-4">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">
                  No upcoming meetings
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  {isPersonalMode || canCreateMeetings
                    ? 'Schedule your first meeting block to begin collaborating.'
                    : 'No upcoming meetings scheduled at this time.'}
                </p>
              </div>
              {(isPersonalMode || canCreateMeetings) && (
                <Button
                  size="sm"
                  onClick={onSchedule}
                  className="mt-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-semibold px-4 h-9"
                >
                  <PlusCircle className="w-4 h-4 mr-1.5" />
                  Schedule Meeting
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          meetings.map((meeting) => (
            <MeetingCard
              key={meeting.meetingId}
              meeting={meeting}
              showJoinButton={true}
            />
          ))
        )}
      </div>
    </div>
  );
}
