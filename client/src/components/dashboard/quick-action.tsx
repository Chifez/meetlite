import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Keyboard, ArrowRight } from 'lucide-react';
import { useCanCreateMeetings } from '@/hooks/use-permissions';
import { useWorkspace } from '@/contexts/workspace-context';

export default function QuickActions({
  onSchedule,
  onJoin,
}: {
  onSchedule: () => void;
  onJoin: (joinRoomId: string) => void;
  onQuickMeeting?: () => void;
}) {
  const { isPersonalMode } = useWorkspace();
  const canCreateMeetings = useCanCreateMeetings();
  const [joinRoomId, setJoinRoomId] = useState('');

  const handleJoin = () => {
    if (joinRoomId.trim()) {
      onJoin(joinRoomId.trim());
    }
  };

  const showSchedule = isPersonalMode || canCreateMeetings;

  return (
    <div className={`grid gap-3 items-stretch ${showSchedule ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
      {/* 1. Schedule Card */}
      {showSchedule && (
        <button
          type="button"
          onClick={onSchedule}
          className="text-left bg-card border border-border/80 hover:border-primary/40 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all group flex items-center gap-3.5 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-lg bg-surface-sunken text-foreground flex items-center justify-center shrink-0 border border-border/60 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            <Calendar className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              Schedule
            </h3>
            <p className="text-[11px] text-muted-foreground truncate">
              Book and invite
            </p>
          </div>
        </button>
      )}

      {/* 2. Join Meeting with Inline Input */}
      <div className="bg-card border border-border/80 rounded-xl p-3.5 shadow-2xs flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-surface-sunken text-foreground flex items-center justify-center shrink-0 border border-border/60">
          <Keyboard className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="relative flex-1">
          <Input
            placeholder="Enter meeting code"
            value={joinRoomId}
            onChange={(e) => setJoinRoomId(e.target.value)}
            className="pr-8 rounded-lg bg-surface-sunken/60 border-border/80 focus-visible:ring-1 focus-visible:ring-primary text-xs h-8 placeholder:text-muted-foreground/70"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleJoin();
              }
            }}
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={handleJoin}
            disabled={!joinRoomId.trim()}
            className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-primary hover:bg-transparent rounded-md transition-colors"
            aria-label="Join Room"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
