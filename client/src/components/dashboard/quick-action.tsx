import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Keyboard, Play, ArrowRight } from 'lucide-react';
import { useUIStore } from '@/stores';
import { useCanCreateMeetings } from '@/hooks/use-permissions';
import { useWorkspace } from '@/contexts/workspace-context';
import { cn } from '@/lib/utils';

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

  const showSchedule = isPersonalMode || canCreateMeetings;

  return (
    <div className={cn("grid gap-6 items-stretch", showSchedule ? "md:grid-cols-3" : "md:grid-cols-2")}>
      {/* 1. Schedule Meeting */}
      {showSchedule && (
        <div className="glass-card hover:border-primary/50 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between p-6 rounded-2xl relative overflow-hidden group">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20 flex items-center justify-center transition-colors group-hover:bg-purple-500/20">
                <Plus className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Schedule Meeting</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Book a meeting slot on the calendar and dispatch email invites to guests automatically.
            </p>
          </div>
          <div className="pt-4 mt-auto">
            <Button
              size="sm"
              onClick={onSchedule}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              Schedule Meeting
            </Button>
          </div>
        </div>
      )}

      {/* 2. Join Meeting */}
      <div className="glass-card hover:border-primary/50 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between p-6 rounded-2xl relative overflow-hidden group">
        <div className="space-y-4 flex-1 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center transition-colors group-hover:bg-blue-500/20">
                <Keyboard className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Join Meeting</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Instantly enter an ongoing video call workspace by inputting its unique code.
            </p>
          </div>
          
          {/* Nested Button Input widget */}
          <div className="relative flex items-center mt-3 pt-1">
            <Input
              placeholder="Enter meeting code"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              className="pr-10 rounded-xl bg-muted/30 border-border/60 focus:border-primary text-xs h-9"
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
              className="absolute right-1 h-7.5 w-7.5 hover:bg-primary/20 text-primary rounded-lg transition-colors"
              disabled={!joinRoomId.trim()}
              aria-label="Join Room"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Start Instant Meeting */}
      <div className="glass-card hover:border-primary/50 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between p-6 rounded-2xl relative overflow-hidden group">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center transition-colors group-hover:bg-emerald-500/20">
              <Play className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-foreground">Instant Meeting</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Create an empty meeting lobby immediately and share its direct URL to invite participants.
          </p>
        </div>
        <div className="pt-4 mt-auto">
          <Button
            size="sm"
            onClick={onQuickMeeting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            disabled={globalLoading}
          >
            {globalLoading ? 'Creating Room...' : 'Start Quick Meeting'}
          </Button>
        </div>
      </div>
    </div>
  );
}
