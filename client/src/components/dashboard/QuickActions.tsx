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

export default function QuickActions({
  onSchedule,
  onJoin,
  onQuickMeeting,
}: {
  onSchedule: () => void;
  onJoin: (joinRoomId: string) => void;
  onQuickMeeting: () => void;
}) {
  const [joinRoomId, setJoinRoomId] = useState('');
  const { globalLoading } = useUIStore();

  const handleJoin = () => {
    onJoin(joinRoomId);
  };

  return (
    <div className="grid md:grid-cols-3 gap-8">
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5" />
            Schedule Meeting
          </CardTitle>
          <CardDescription>
            Plan a meeting for later and send invites
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button className="w-full" onClick={onSchedule}>
            Schedule Meeting
          </Button>
        </CardFooter>
      </Card>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Join Meeting
          </CardTitle>
          <CardDescription>Enter a code to join a meeting room</CardDescription>
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
          <Button onClick={handleJoin} className="w-full">
            Join
          </Button>
        </CardFooter>
      </Card>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Start Instant Meeting
          </CardTitle>
          <CardDescription>
            Create a room and start collaborating now
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
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
