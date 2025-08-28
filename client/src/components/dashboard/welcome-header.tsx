import { useWorkspace } from '@/contexts/workspace-context';

interface WelcomeHeaderProps {
  user?: {
    email?: string;
    name?: string;
    useNameInMeetings?: boolean;
  };
}

export default function WelcomeHeader({ user }: WelcomeHeaderProps) {
  const { currentWorkspaceName, isPersonalMode } = useWorkspace();
  const displayName = user?.name || user?.email?.split('@')[0] || 'User';

  return (
    <div className="text-center space-y-4">
      <h1 className="text-3xl font-bold text-foreground mb-2">
        <span className="text-foreground">Welcome,</span>{' '}
        <span className="bg-primary bg-clip-text text-transparent">
          {displayName}
        </span>
      </h1>
      <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
        Ready to connect and collaborate? Start a meeting, join your team, or
        schedule for later.
      </p>
      {!isPersonalMode && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Working in</span>
          <span className="font-medium text-foreground">
            {currentWorkspaceName}
          </span>
        </div>
      )}
    </div>
  );
}
