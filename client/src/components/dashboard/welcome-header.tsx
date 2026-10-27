import { useState } from 'react';
import { useWorkspace } from '@/contexts/workspace-context';
import { Calendar, Play, Search, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

interface WelcomeHeaderProps {
  user?: {
    email?: string;
    name?: string;
    useNameInMeetings?: boolean;
  };
  todayMeetingsCount?: number;
  onSchedule?: () => void;
  onQuickMeeting?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function WelcomeHeader({
  user,
  todayMeetingsCount = 0,
  onSchedule,
  onQuickMeeting,
  searchQuery = '',
  onSearchChange,
}: WelcomeHeaderProps) {
  const { currentWorkspaceName, isPersonalMode } = useWorkspace();
  const displayName = user?.name || user?.email?.split('@')[0] || 'there';

  const todayFormatted = format(new Date(), 'EEE, MMM d');
  const meetingSummary =
    todayMeetingsCount === 0
      ? 'No meetings scheduled today'
      : `${todayMeetingsCount} ${todayMeetingsCount === 1 ? 'meeting' : 'meetings'} today`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
      {/* Left: Greeting & Date/Status */}
      <div className="space-y-0.5">
        <h1 className="text-xl sm:text-[22px] font-semibold text-foreground tracking-tight font-display">
          {getGreeting()}, {displayName}
        </h1>
        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
          <span>{todayFormatted}</span>
          <span className="text-muted-foreground/60">·</span>
          <span>{meetingSummary}</span>
          {!isPersonalMode && currentWorkspaceName && (
            <>
              <span className="text-muted-foreground/60">·</span>
              <span className="text-foreground/80 font-medium">{currentWorkspaceName}</span>
            </>
          )}
        </p>
      </div>

      {/* Right: Search, Schedule, and Instant Meeting */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {onSearchChange && (
          <div className="relative w-36 sm:w-44">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 pl-8 pr-3 text-xs rounded-xl bg-card border-border/80 text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
        )}

        {onQuickMeeting && (
          <Button
            type="button"
            size="sm"
            onClick={onQuickMeeting}
            className="h-9 px-4 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-xs"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Instant meeting</span>
          </Button>
        )}
      </div>
    </div>
  );
}
