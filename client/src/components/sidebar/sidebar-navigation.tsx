import { useLocation } from 'react-router-dom';
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
  const { isPersonalMode } = useWorkspace();
  const isFreePlan = currentPlan === 'free';
  const showTeams = !isPersonalMode && !isFreePlan;

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
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold px-2">
            Teams
          </p>
          <TeamsSwitcher />
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 px-2">
        <ul className="space-y-1.5">
          {visibleNavigationItems.map((item) => {
            const isActive = location.pathname === item.path;
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
                    className="absolute inset-0 bg-primary/10 rounded-xl -z-10 border border-primary/20"
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
                      <Badge
                        variant="outline"
                        className="text-[8px] bg-primary/10 border-primary/25 text-primary px-1 py-0.5 font-bold"
                      >
                        Soon
                      </Badge>
                    )}
                  </div>
                )}
              </Button>
            );

            return (
              <li key={item.path} className="flex justify-center">
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
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
