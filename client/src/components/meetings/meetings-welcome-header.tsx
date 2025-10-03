import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MeetingsWelcomeHeaderProps {
  onSchedule: () => void;
}

export default function MeetingsWelcomeHeader({
  onSchedule,
}: MeetingsWelcomeHeaderProps) {
  return (
    <div className="space-y-4 mb-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          <span className="text-foreground">My </span>
          <span className="bg-primary bg-clip-text text-transparent">
            Meetings
          </span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          View, schedule, and manage all your meetings in one place. Start
          meetings, invite participants, and keep track of your schedule
          effortlessly.
        </p>
      </div>
      <div className="text-center">
        <Button size="sm" onClick={onSchedule}>
          <PlusCircle className="h-4 w-4 mr-2" /> Schedule Meeting
        </Button>
      </div>
    </div>
  );
}
