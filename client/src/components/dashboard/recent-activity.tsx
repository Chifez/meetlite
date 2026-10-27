import { Video, Calendar, Users, Briefcase, LogIn } from 'lucide-react';
import { useWorkspace } from '@/contexts/workspace-context';
import { useActivities, Activity } from '@/hooks/use-activities';
import { formatDistanceToNow } from 'date-fns';
import { ACTIVITY_TYPES } from '@/lib/constants';

function getActivityIcon(action: string) {
  switch (action) {
    case ACTIVITY_TYPES.MEETING_SCHEDULED:
      return <Calendar className="w-3.5 h-3.5 text-primary" />;
    case ACTIVITY_TYPES.QUICK_MEETING_STARTED:
      return <Video className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
    case ACTIVITY_TYPES.MEETING_JOINED:
      return <LogIn className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />;
    case ACTIVITY_TYPES.MEMBER_INVITED:
    case ACTIVITY_TYPES.MEMBER_JOINED:
    case ACTIVITY_TYPES.MEMBER_REMOVED:
      return <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
    default:
      return <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function getActivityText(activity: Activity) {
  const actor = activity.user?.name || activity.user?.email || 'Someone';
  switch (activity.action) {
    case ACTIVITY_TYPES.MEETING_SCHEDULED:
      return (
        <span>
          <strong className="text-foreground font-semibold">{actor}</strong> scheduled{' '}
          <span className="text-muted-foreground">{activity.metadata?.title || 'a meeting'}</span>
        </span>
      );
    case ACTIVITY_TYPES.QUICK_MEETING_STARTED:
      return (
        <span>
          <strong className="text-foreground font-semibold">{actor}</strong> started an instant meeting
        </span>
      );
    case ACTIVITY_TYPES.MEETING_JOINED:
      return (
        <span>
          <strong className="text-foreground font-semibold">{actor}</strong> joined a meeting
        </span>
      );
    case ACTIVITY_TYPES.MEMBER_INVITED:
      return (
        <span>
          <strong className="text-foreground font-semibold">{actor}</strong> invited{' '}
          <strong className="text-foreground font-semibold">{activity.metadata?.email}</strong>
        </span>
      );
    default:
      return (
        <span>
          <strong className="text-foreground font-semibold">{actor}</strong> performed {activity.action.replace(/_/g, ' ').toLowerCase()}
        </span>
      );
  }
}

export default function RecentActivity() {
  const { isPersonalMode, activeOrganization } = useWorkspace();
  const { activities, loading } = useActivities(activeOrganization?.id);

  return (
    <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-2xs">
      <div className="pb-3 border-b border-border/60">
        <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Recent Activity
        </h2>
      </div>

      <div className="pt-2">
        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Loading activity...
          </div>
        ) : activities.length === 0 ? (
          <div className="py-5 text-center space-y-1">
            <p className="text-xs font-medium text-foreground">No recent activity</p>
            <p className="text-[11px] text-muted-foreground">
              Actions and meeting events will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {activities.slice(0, 4).map((activity) => (
              <div key={activity.id} className="py-2.5 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-surface-sunken border border-border/60 flex shrink-0 items-center justify-center mt-0.5">
                  {getActivityIcon(activity.action)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground leading-snug">
                    {getActivityText(activity)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 font-medium">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
