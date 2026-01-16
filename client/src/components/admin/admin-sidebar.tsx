import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { ADMIN_NAVIGATION_ITEMS } from '@/lib/admin-constants';
import { useIsDesktop } from '@/hooks/use-media-query';
import type { NavigationItem } from '@/lib/types';

import { SidebarHeader } from '../sidebar/sidebar-header';
import UserMenu from '../ui/user-menu';

interface AdminSidebarProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export function AdminSidebar({
  mobileMenuOpen,
  setMobileMenuOpen,
}: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();

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

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <nav className="flex-1 p-2">
            <ul className="space-y-1">
              {ADMIN_NAVIGATION_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;

                return (
                  <li key={item.path}>
                    <button
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                        isContentVisible
                          ? 'justify-center px-2'
                          : 'justify-start',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent',
                        !item.available && 'opacity-50 cursor-not-allowed'
                      )}
                      onClick={() => handleNavigationClick(item)}
                      disabled={!item.available}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {!isContentVisible && (
                        <span className="text-xs font-medium">
                          {item.label}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="p-4 border-t border-sidebar-border">
          <UserMenu
            collapsed={collapsed}
            onOpenSettings={() =>
              navigate('/admin?settings=true', { replace: false })
            }
          />
        </div>
      </div>
    </>
  );
}
