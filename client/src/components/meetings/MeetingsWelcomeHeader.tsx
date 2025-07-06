import { PlusCircle } from 'lucide-react';
import { Button } from '../ui/button';

interface MeetingsWelcomeHeaderProps {
  onSchedule: () => void;
}

export default function MeetingsWelcomeHeader({
  onSchedule,
}: MeetingsWelcomeHeaderProps) {
  return (
    <div className="space-y-6 text-center mb-8">
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
        <span className="text-gray-900 dark:text-gray-100">My </span>
        <span className="bg-primary bg-clip-text text-transparent">
          Meetings
        </span>
      </h1>
      <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
        View, schedule, and manage all your meetings in one place. Start
        meetings, invite participants, and keep track of your schedule
        effortlessly.
      </p>
      <Button size="lg" className="" onClick={onSchedule}>
        <PlusCircle className="h-5 w-5 mr-2" /> Schedule Meeting
      </Button>
    </div>
  );
}
