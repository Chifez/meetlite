import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MeetingsWelcomeHeaderProps {
  onSchedule: () => void;
}

export default function MeetingsWelcomeHeader({
  onSchedule,
}: MeetingsWelcomeHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-[1.25rem] font-bold text-foreground tracking-[-0.025em]">
          My Meetings
        </h1>
        <p className="text-[0.8125rem] text-muted-foreground mt-0.5">
          View, schedule, and manage all your meetings in one place.
        </p>
      </div>
      <div>
        <Button id="meetings-schedule-btn" size="sm" onClick={onSchedule} className="gap-1.5 rounded-xl font-semibold">
          <PlusCircle className="h-4 w-4" /> Schedule Meeting
        </Button>
      </div>
    </div>
  );
}
