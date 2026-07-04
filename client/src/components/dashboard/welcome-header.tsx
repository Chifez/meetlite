import { useWorkspace } from '@/contexts/workspace-context';
import { Building2 } from 'lucide-react';

interface WelcomeHeaderProps {
  user?: {
    email?: string;
    name?: string;
    useNameInMeetings?: boolean;
  };
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function WelcomeHeader({ user }: WelcomeHeaderProps) {
  const { currentWorkspaceName, isPersonalMode } = useWorkspace();
  const displayName = user?.name || user?.email?.split('@')[0] || 'there';

  return (
    <div className="space-y-1">
      <h1 className="text-[1.5rem] font-bold text-foreground tracking-[-0.025em]">
        {getGreeting()}, {displayName}.
      </h1>
      <p className="text-[0.875rem] text-muted-foreground">
        {isPersonalMode
          ? 'Start a new meeting, join a room, or schedule for later.'
          : `You're working in `}
        {!isPersonalMode && (
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Building2 className="w-3.5 h-3.5" />
            {currentWorkspaceName}
          </span>
        )}
      </p>
    </div>
  );
}
