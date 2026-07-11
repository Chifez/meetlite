import { Video, Calendar, Users, Briefcase, LogIn } from 'lucide-react';
import { useWorkspace } from '@/contexts/workspace-context';
import { useActivities, Activity } from '@/hooks/use-activities';
import { formatDistanceToNow } from 'date-fns';
import { ACTIVITY_TYPES } from '@/lib/constants';


function getActivityIcon(action: string) {
  switch (action) {
    case ACTIVITY_TYPES.MEETING_SCHEDULED:
      return <Calendar className="w-4 h-4 text-primary" />;
    case ACTIVITY_TYPES.QUICK_MEETING_STARTED:
      return <Video className="w-4 h-4 text-emerald-500" />;
    case ACTIVITY_TYPES.MEETING_JOINED:
      return <LogIn className="w-4 h-4 text-sky-500" />;
    case ACTIVITY_TYPES.MEMBER_INVITED:
    case ACTIVITY_TYPES.MEMBER_JOINED:
    case ACTIVITY_TYPES.MEMBER_REMOVED:
      return <Users className="w-4 h-4 text-blue-500" />;
    default:
      return <Briefcase className="w-4 h-4 text-ink-muted" />;
  }
}

function getActivityText(activity: Activity) {
  const actor = activity.user?.name || activity.user?.email || 'Someone';
  switch (activity.action) {
    case ACTIVITY_TYPES.MEETING_SCHEDULED:
      return (
        <span>
          <strong className="text-ink font-semibold">{actor}</strong> scheduled a meeting:{' '}
          <span className="text-ink-muted">{activity.metadata?.title || 'Untitled'}</span>
        </span>
      );
    case ACTIVITY_TYPES.QUICK_MEETING_STARTED:
      return (
        <span>
          <strong className="text-ink font-semibold">{actor}</strong> started an instant meeting
        </span>
      );
    case ACTIVITY_TYPES.MEETING_JOINED:
      return (
        <span>
          <strong className="text-ink font-semibold">{actor}</strong> joined a meeting
        </span>
      );
    case ACTIVITY_TYPES.MEMBER_INVITED:
      return (
        <span>
          <strong className="text-ink font-semibold">{actor}</strong> invited{' '}
          <strong className="text-ink font-semibold">{activity.metadata?.email}</strong>
        </span>
      );
    default:
      return (
        <span>
          <strong className="text-ink font-semibold">{actor}</strong> performed {activity.action.replace(/_/g, ' ').toLowerCase()}
        </span>
      );
  }
}

export default function RecentActivity() {
  const { isPersonalMode, activeOrganization } = useWorkspace();
  const { activities, loading } = useActivities(activeOrganization?.id);

  if (loading) {
    return (
    <div className="h-full">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-muted mb-5">
        Recent Activity
      </h2>
        <div className="bg-surface border border-border rounded-xl p-6 flex flex-col items-center justify-center min-h-[200px]">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (activities.length > 0) {
    return (
    <div className="h-full">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-muted mb-5">
        Recent Activity
      </h2>
        
        <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 flex flex-col gap-4 max-h-[400px] overflow-y-auto">
          {activities.map((activity) => (
            <div key={activity.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-surface-sunken border border-border/50 flex flex-shrink-0 items-center justify-center">
                {getActivityIcon(activity.action)}
              </div>
              <div className="flex flex-col pt-1">
                <p className="text-sm text-ink-muted leading-tight">
                  {getActivityText(activity)}
                </p>
                <p className="text-[11px] text-ink-muted/70 mt-1">
                  {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-muted mb-5">
        Getting Started
      </h2>
      
      <div className="bg-surface border border-border rounded-xl p-5 h-[320px] flex flex-col justify-center">
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-bold text-ink">Welcome to MeetLite</h3>
            <p className="text-xs text-ink-muted mt-1 leading-snug">
              Complete these quick steps to get the most out of your meetings.
            </p>
          </div>
          
          <div className="space-y-3">
            {/* Step 1 */}
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold">1</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-ink">Schedule a meeting</p>
                <p className="text-[11px] text-ink-muted mt-0.5">Invite your team to collaborate.</p>
              </div>
            </div>
            
            {/* Step 2 */}
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-surface-sunken text-ink flex items-center justify-center border border-border/50 flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold">2</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-ink">Connect your calendar</p>
                <p className="text-[11px] text-ink-muted mt-0.5">Automatically sync events from Google Calendar.</p>
              </div>
            </div>
            
            {/* Step 3 */}
            {!isPersonalMode && (
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-surface-sunken text-ink flex items-center justify-center border border-border/50 flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold">3</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink">Invite teammates</p>
                  <p className="text-[11px] text-ink-muted mt-0.5">Grow {activeOrganization?.name || 'your team'}.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
