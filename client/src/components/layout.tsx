import { useCallback, useState } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import Navbar from './navbar';
import Breadcrumb from './sidebar/breadcrumb';
import SettingsModal from './dashboard/settings-modal';
import { cn } from '@/lib/utils';

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive route info (simple checks don't need memoization)
  const pathname = location.pathname;
  const isRoomPage =
    pathname.startsWith('/room/') || pathname.startsWith('/lobby/');
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/onboarding' ||
    pathname.startsWith('/invite/');
  const isLandingPage = pathname === '/';
  const isAdminPage = pathname.startsWith('/admin');
  const shouldShowNavbar = !isRoomPage && !isAuthPage && !isAdminPage;

  // Simple derived value (no memoization needed)
  const showSettingsModal = searchParams.get('settings') === 'true';

  // Stable handler for closing settings modal
  const closeSettingsModal = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('settings');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Landing page layout - full width, no sidebar
  if (isLandingPage) {
    return (
      <div className="flex flex-col">
        {shouldShowNavbar && (
          <Navbar
            isMobileMenuOpen={isMobileMenuOpen}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
          />
        )}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    );
  }

  // Admin pages use AdminLayout internally, so skip regular Layout
  if (isAdminPage) {
    return (
      <main className="flex-1">
        <Outlet />
      </main>
    );
  }

  return (
    <div
      className={cn(
        'relative flex flex-row bg-primary/10',
        shouldShowNavbar && 'lg:max-h-screen'
      )}
    >
      {/* Sidebar */}
      {shouldShowNavbar && (
        <Navbar
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
      )}

      {/* Main content area */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 scrollbar-hide',
          shouldShowNavbar &&
            'lg:border lg:rounded-xl lg:m-2 lg:max-h-screen overflow-y-scroll '
        )}
      >
        {/* Breadcrumb */}
        {shouldShowNavbar && (
          <div className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b p-4">
            <Breadcrumb
              currentPath={location.pathname}
              isMobileMenuOpen={isMobileMenuOpen}
              setIsMobileMenuOpen={setIsMobileMenuOpen}
            />
          </div>
        )}

        {/* Page content */}
        <main className="flex-1">
          <Outlet />
        </main>

        {/* Global Settings Modal - Available on all pages */}
        {shouldShowNavbar && (
          <SettingsModal
            key={showSettingsModal ? 'open' : 'close'}
            open={showSettingsModal}
            onOpenChange={(open) => !open && closeSettingsModal()}
          />
        )}
      </div>
    </div>
  );
};

export default Layout;
