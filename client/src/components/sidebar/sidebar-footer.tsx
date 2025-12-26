import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import UserMenu from '@/components/ui/user-menu';
import PlanBadge, { needsUpgrade } from '@/components/ui/plan-badge';
import { useCurrentPlan } from '@/hooks/use-current-plan';
import { useNavigate } from 'react-router-dom';
import { NotificationBell } from '@/components/notifications/notification-bell';

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
  const { currentPlan } = useCurrentPlan();
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
            <PlanBadge />
          </div>

          {needsUpgrade(currentPlan) && (
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

      {/* Notification Bell - Desktop only (mobile shows in breadcrumb) */}
      <div className="hidden lg:flex items-center justify-center">
        <NotificationBell variant="sidebar" />
      </div>

      <UserMenu
        collapsed={collapsed}
        onOpenSettings={() => navigate('?settings=true', { replace: false })}
      />
    </div>
  );
}
