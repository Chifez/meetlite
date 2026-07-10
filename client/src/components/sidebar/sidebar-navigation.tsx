import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OrganizationSwitcher } from '@/components/sidebar/organization-switcher';
import { TeamsSwitcher } from '@/components/sidebar/teams-switcher';
import { useCurrentPlan } from '@/hooks/use-current-plan';
import { useWorkspace } from '@/contexts/workspace-context';
import type { NavigationItem } from '@/lib/types';
import { motion } from 'motion/react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { StatusPill } from '@/components/ui/status-pill';
import { Plus } from 'lucide-react';
import { useTeamsStore } from '@/stores/teams-store';

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
  const navigate = useNavigate();
  const { currentPlan } = useCurrentPlan();
  const { isPersonalMode } = useWorkspace();
  const isFreePlan = currentPlan === 'free';
  const showTeams = !isPersonalMode && !isFreePlan;
  const { teams } = useTeamsStore();
  const hasTeams = teams && teams.length > 0;

  return (
    <div className="flex flex-col space-y-4 py-4">
      {/* Workspace Switcher Section */}
      <div className={cn("px-3 flex justify-center", !isContentVisible ? "items-stretch" : "items-center")}>
        {!isContentVisible ? (
          <div className="w-full space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold px-2">
              Workspace
            </p>
            <OrganizationSwitcher collapsed={false} />
          </div>
        ) : (
          <OrganizationSwitcher collapsed={true} />
        )}
      </div>

      {/* Teams Switcher Section */}
      {showTeams && !isContentVisible && (
        <div className="px-3 space-y-1">
          <div className="flex items-center justify-between px-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
              Teams
            </p>
            {hasTeams && (
              <button 
                onClick={() => navigate('/settings/organization')} 
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="Create team"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <TeamsSwitcher />
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 px-2">
        <ul className="space-y-1.5">
          {visibleNavigationItems.map((item) => {
            const isActive = location.pathname === item.path || (item.children && location.pathname.startsWith(item.path));
            const Icon = item.icon;

            const buttonContent = (
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-3 relative rounded-xl transition-colors duration-200 z-10',
                  isContentVisible ? 'justify-center p-0 h-10 w-10' : 'px-3.5 py-2.5 h-10',
                  isActive ? 'text-primary font-bold bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50',
                  !item.available && 'opacity-50 cursor-not-allowed'
                )}
                onClick={() => onNavigationClick(item)}
                disabled={!item.available}
              >
                {/* Active Indicator Background Pill */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    className="absolute inset-0 bg-primary/[0.08] rounded-xl -z-10"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}

                {/* Active Indicator Left Notch */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-notch"
                    className="absolute left-0 top-2.5 bottom-2.5 w-1 bg-primary rounded-r-md"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}

                <Icon className={cn("h-4.5 w-4.5 flex-shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground")} />
                {!isContentVisible && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{item.label}</span>
                    {!item.available && (
                      <StatusPill variant="neutral">
                        Soon
                      </StatusPill>
                    )}
                  </div>
                )}
              </Button>
            );

            return (
              <li key={item.path} className="flex flex-col justify-center">
                {isContentVisible ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {buttonContent}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover/95 border border-border shadow-md rounded-lg font-semibold px-2.5 py-1.5 text-xs text-foreground backdrop-blur-md">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  buttonContent
                )}
                {item.children && !isContentVisible && location.pathname.startsWith(item.path) && (
                  <ul className="pl-10 space-y-1 mt-1">
                    {item.children.map(child => {
                      if (child.organizationOnly && isPersonalMode) return null;
                      const isChildActive = location.pathname === child.path || (child.path === '/settings/profile' && location.pathname === '/settings');
                      return (
                        <li key={child.path}>
                           <Button
                            variant="ghost"
                            className={cn(
                              'w-full justify-start py-1.5 h-8 px-3 rounded-lg text-xs transition-colors',
                              isChildActive ? 'text-primary font-bold bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30',
                              !child.available && 'opacity-50 cursor-not-allowed'
                            )}
                            onClick={() => onNavigationClick({ ...child, icon: item.icon } as NavigationItem)}
                            disabled={!child.available}
                          >
                            {child.label}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
