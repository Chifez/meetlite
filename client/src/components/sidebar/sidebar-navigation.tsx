import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OrganizationSwitcher } from '@/components/sidebar/organization-switcher';
import { TeamsSwitcher } from '@/components/sidebar/teams-switcher';
import { useCurrentPlan } from '@/hooks/use-current-plan';
import type { NavigationItem } from '@/lib/types';

interface SidebarNavigationProps {
  isContentVisible: boolean;
  visibleNavigationItems: NavigationItem[];
  onNavigationClick: (item: NavigationItem) => void;
}

export function SidebarNavigation({
  isContentVisible,
  visibleNavigationItems,
  onNavigationClick,
}: SidebarNavigationProps) {
  const location = useLocation();
  const { currentPlan } = useCurrentPlan();
  const isFreePlan = currentPlan === 'free';

  return (
    <>
      {!isContentVisible && (
        <>
          <div className="px-4 py-2 border-b border-sidebar-border">
            <div className="mb-1">
              <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wide font-medium">
                Workspace
              </p>
            </div>
            <OrganizationSwitcher />
          </div>

          {!isFreePlan && (
            <>
              <div className="px-4 py-2 border-b border-sidebar-border">
                <div className="mb-1">
                  <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wide font-medium">
                    Teams
                  </p>
                </div>
                <TeamsSwitcher />
              </div>
            </>
          )}
        </>
      )}

      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {visibleNavigationItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <li key={item.path}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent',
                    isContentVisible && 'justify-center px-2',
                    isActive &&
                      'bg-sidebar-accent text-sidebar-accent-foreground',
                    !item.available && 'opacity-50 cursor-not-allowed'
                  )}
                  onClick={() => onNavigationClick(item)}
                  disabled={!item.available}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!isContentVisible && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{item.label}</span>
                      {!item.available && (
                        <Badge
                          variant="outline"
                          className="text-[8px] bg-primary/50 px-1 py-.5 font-medium"
                        >
                          Soon
                        </Badge>
                      )}
                    </div>
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
