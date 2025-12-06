import { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Users, CalendarDays } from 'lucide-react';
import { useUIStore } from '@/stores';
import { useCanCreateMeetings } from '@/hooks/use-permissions';
import { useWorkspace } from '@/contexts/workspace-context';

export default function QuickActions({
  onSchedule,
  onJoin,
  onQuickMeeting,
}: {
  onSchedule: () => void;
  onJoin: (joinRoomId: string) => void;
  onQuickMeeting: () => void;
}) {
  const { isPersonalMode } = useWorkspace();
  const canCreateMeetings = useCanCreateMeetings();
  const [joinRoomId, setJoinRoomId] = useState('');
  const { globalLoading } = useUIStore();

  const handleJoin = () => {
    onJoin(joinRoomId);
  };

  return (
    <div className="grid md:grid-cols-3 gap-8">
      {(isPersonalMode || canCreateMeetings) && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <PlusCircle className="h-4 w-4" />
              Schedule Meeting
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Plan a meeting for later and send invites
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button size="sm" className="w-full" onClick={onSchedule}>
              Schedule Meeting
            </Button>
          </CardFooter>
        </Card>
      )}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-4 w-4" />
            Join Meeting
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Enter a code to join a meeting room
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Enter meeting code"
            value={joinRoomId}
            onChange={(e) => setJoinRoomId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleJoin();
              }
            }}
          />
        </CardContent>
        <CardFooter>
          <Button size="sm" onClick={handleJoin} className="w-full">
            Join
          </Button>
        </CardFooter>
      </Card>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <CalendarDays className="h-4 w-4" />
            Start Instant Meeting
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Create a room and start collaborating now
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            size="sm"
            onClick={onQuickMeeting}
            className="w-full"
            disabled={globalLoading}
          >
            {globalLoading ? 'Creating...' : 'Start Quick Meeting'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
