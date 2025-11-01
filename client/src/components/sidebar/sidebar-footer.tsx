import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import UserMenu from '@/components/ui/user-menu';
import PlanBadge, { needsUpgrade } from '@/components/ui/plan-badge';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/contexts/workspace-context';
import { useNavigate } from 'react-router-dom';

interface SidebarFooterProps {
  collapsed: boolean;
  isContentVisible: boolean;
  onOpenPlanDialog: () => void;
}

export function SidebarFooter({
  collapsed,
  isContentVisible,
  onOpenPlanDialog,
}: SidebarFooterProps) {
  const { user } = useAuth();
  const { activeOrganization } = useWorkspace();
  const navigate = useNavigate();

  return (
    <div className="p-4 border-t border-sidebar-border space-y-3">
      {/* Current Plan Display */}
      {!isContentVisible && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wide font-medium">
              Current Plan
            </p>
            <PlanBadge
              activeOrganization={activeOrganization}
              userPlan={user?.plan}
            />
          </div>

          {needsUpgrade(activeOrganization, user?.plan) && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={onOpenPlanDialog}
            >
              <Zap className="w-3 h-3 mr-2" />
              Upgrade Plan
            </Button>
          )}
        </div>
      )}

      <UserMenu
        collapsed={collapsed}
        onOpenSettings={() => navigate('?settings=true', { replace: false })}
      />
    </div>
  );
}
