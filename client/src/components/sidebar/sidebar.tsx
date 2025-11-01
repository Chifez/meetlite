import { useState } from 'react';
import { Button } from '@/components/ui/button';
import PlanSettingsDialog from '@/components/plan/plan-settings-dialog';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrganizationSwitcher } from '@/components/sidebar/organization-switcher';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/contexts/workspace-context';
import UserMenu from '@/components/ui/user-menu';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from '@/components/logo';
import { NAVIGATION_ITEMS } from '@/lib/constants';
import PlanBadge, { needsUpgrade } from '@/components/ui/plan-badge';
import { Badge } from '@/components/ui/badge';

interface SidebarProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export function Sidebar({ mobileMenuOpen, setMobileMenuOpen }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const { user } = useAuth();
  const { activeOrganization, isPersonalMode } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigationClick = (item: any) => {
    if (item.available) {
      navigate(item.path);
      setMobileMenuOpen(false);
      setCollapsed(true);
    }
    // If not available, do nothing (link is disabled)
  };

  return (
    <>
      {/* Mobile/Tablet overlay - closes sidebar when clicked outside */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div
        className={cn(
          'flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300',
          // Mobile & Tablet (< 1024px): Fixed overlay
          'fixed lg:sticky lg:top-0 z-50 lg:z-auto h-full lg:h-screen',
          'lg:flex',
          // Mobile & Tablet behavior (reduced width for medium screens)
          mobileMenuOpen
            ? 'translate-x-0 w-[70vw] md:w-[280px]'
            : '-translate-x-full lg:translate-x-0',
          // Large screen behavior (≥ 1024px)
          collapsed && 'lg:w-16',
          !collapsed && 'lg:w-64'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          {!(collapsed && window.innerWidth >= 1024) && (
            <div className="flex items-center gap-2">
              <Logo />
            </div>
          )}
          <div className="lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen?.(false)}
              className="text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="hidden lg:block">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className="text-sidebar-foreground hover:bg-sidebar-accent"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {!(collapsed && window.innerWidth >= 1024) && (
          <div className="px-4 py-2 border-b border-sidebar-border">
            <div className="mb-1">
              <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wide font-medium">
                Workspace
              </p>
            </div>

            {/* Organization Switcher - Now a compact dropdown */}
            <OrganizationSwitcher />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-2">
          <ul className="space-y-1">
            {NAVIGATION_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              // Hide organization-only items when in personal mode
              if (item.organizationOnly && isPersonalMode) {
                return null;
              }

              return (
                <li key={item.path}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={cn(
                      'w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent',
                      collapsed &&
                        window.innerWidth >= 1024 &&
                        'justify-center px-2',
                      isActive &&
                        'bg-sidebar-accent text-sidebar-accent-foreground',
                      !item.available && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={() => handleNavigationClick(item)}
                    disabled={!item.available}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {!(collapsed && window.innerWidth >= 1024) && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          {item.label}
                        </span>
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

        <div className="p-4 border-t border-sidebar-border space-y-3">
          {/* Current Plan Display */}
          {!(collapsed && window.innerWidth >= 1024) && (
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
                  onClick={() => setPlanDialogOpen(true)}
                >
                  <Zap className="w-3 h-3 mr-2" />
                  Upgrade Plan
                </Button>
              )}
            </div>
          )}

          <UserMenu
            collapsed={collapsed}
            onOpenSettings={() =>
              navigate('?settings=true', { replace: false })
            }
          />
        </div>
      </div>

      {/* Plan Settings Dialog */}
      <PlanSettingsDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        currentPlan={
          activeOrganization?.plan?.type || user?.plan?.type || 'free'
        }
      />
    </>
  );
}
