import { useState, useMemo, useCallback } from 'react';
import PlanSettingsDialog from '@/components/plan/plan-settings-dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/contexts/workspace-context';
import { useNavigate } from 'react-router-dom';
import { NAVIGATION_ITEMS } from '@/lib/constants';
import { useIsDesktop } from '@/hooks/use-media-query';
import type { NavigationItem } from '@/lib/types';

import { SidebarHeader } from './sidebar-header';
import { SidebarNavigation } from './sidebar-navigation';
import { SidebarFooter } from './sidebar-footer';

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
  const isDesktop = useIsDesktop();

  // Memoize visible navigation items to prevent unnecessary recalculations
  const visibleNavigationItems = useMemo<NavigationItem[]>(() => {
    return NAVIGATION_ITEMS.filter(
      (item) => !(item.organizationOnly && isPersonalMode)
    );
  }, [isPersonalMode]);

  // Memoize current plan calculation (prevent recalculation on unrelated re-renders)
  const currentPlan = useMemo(
    () => activeOrganization?.plan?.type || user?.plan?.type || 'free',
    [activeOrganization?.plan?.type, user?.plan?.type]
  );

  // Simple boolean expression (no memoization needed)
  const isContentVisible = collapsed && isDesktop;

  // Stable handler for navigation clicks
  const handleNavigationClick = useCallback(
    (item: NavigationItem) => {
      if (item.available) {
        navigate(item.path);
        setMobileMenuOpen(false);
        setCollapsed(true);
      }
    },
    [navigate, setMobileMenuOpen]
  );

  // Stable handler for toggling collapse
  const handleToggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  // Stable handler for closing mobile menu
  const handleCloseMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, [setMobileMenuOpen]);

  // Stable handler for opening plan dialog
  const handleOpenPlanDialog = useCallback(() => {
    setPlanDialogOpen(true);
  }, []);

  return (
    <>
      {/* Mobile/Tablet overlay - closes sidebar when clicked outside */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={handleCloseMobileMenu}
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
        <SidebarHeader
          collapsed={collapsed}
          isDesktop={isDesktop}
          onToggleCollapse={handleToggleCollapse}
          onCloseMobile={handleCloseMobileMenu}
        />

        <SidebarNavigation
          isContentVisible={isContentVisible}
          visibleNavigationItems={visibleNavigationItems}
          onNavigationClick={handleNavigationClick}
        />

        <SidebarFooter
          collapsed={collapsed}
          isContentVisible={isContentVisible}
          onOpenPlanDialog={handleOpenPlanDialog}
        />
      </div>

      {/* Plan Settings Dialog */}
      <PlanSettingsDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        currentPlan={currentPlan}
      />
    </>
  );
}
