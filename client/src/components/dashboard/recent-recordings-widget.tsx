import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play, Video } from 'lucide-react';
import { useWorkspace } from '@/contexts/workspace-context';
import { useMeetingAssets } from '@/hooks/use-meeting-assets';
import { formatDistanceToNow } from 'date-fns';

function formatDuration(durationSeconds: number): string {
  if (!durationSeconds || isNaN(durationSeconds)) return '0:00';
  const mins = Math.floor(durationSeconds / 60);
  const secs = Math.floor(durationSeconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function RecentRecordingsWidget() {
  const { activeOrganization } = useWorkspace();
  const { recordings, loading } = useMeetingAssets(activeOrganization?.id);
  const navigate = useNavigate();

  const recentList = recordings.slice(0, 3);

  return (
    <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-2xs">
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Recent Recordings
        </h2>
        <Link
          to="/recordings"
          className="text-xs font-semibold text-primary hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="pt-2">
        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Loading recordings...
          </div>
        ) : recentList.length === 0 ? (
          <div className="py-5 text-center space-y-1">
            <p className="text-xs font-medium text-foreground">No recordings yet</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Record your next meeting to review replays and notes.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {recentList.map((rec) => {
              const title = rec.title || (rec as any).meetingTitle || 'Meeting Recording';
              const durationStr = formatDuration(rec.recording?.duration ?? (rec as any).duration ?? 0);
              const timeAgo = rec.createdAt
                ? formatDistanceToNow(new Date(rec.createdAt), { addSuffix: false }) + ' ago'
                : 'Recently';

              return (
                <button
                  type="button"
                  key={rec.id}
                  onClick={() => navigate('/recordings')}
                  className="w-full text-left py-2.5 flex items-center gap-3 hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface-sunken flex items-center justify-center shrink-0 border border-border/60 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors text-muted-foreground">
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {durationStr} · {timeAgo}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
