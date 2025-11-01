import { useCallback, useState } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import Navbar from './navbar';
import Breadcrumb from './sidebar/breadcrumb';
import SettingsModal from './dashboard/settings-modal';

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive route info (simple checks don't need memoization)
  const pathname = location.pathname;
  const isRoomPage = pathname.startsWith('/room/');
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/onboarding' ||
    pathname.startsWith('/invite/');
  const isLandingPage = pathname === '/';
  const shouldShowNavbar = !isRoomPage && !isAuthPage;

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

  return (
    <div className="relative flex flex-row">
      {/* Sidebar */}
      {shouldShowNavbar && (
        <Navbar
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Breadcrumb */}
        {shouldShowNavbar && (
          <div className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b p-2">
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
