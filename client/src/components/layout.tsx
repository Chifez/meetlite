import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import Navbar from './navbar';
import Breadcrumb from './sidebar/breadcrumb';
import SettingsModal from './dashboard/settings-modal';
import { useState } from 'react';

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isRoomPage = location.pathname.startsWith('/room/');
  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/signup' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/reset-password' ||
    location.pathname === '/onboarding' ||
    location.pathname.startsWith('/invite/');
  const isLandingPage = location.pathname === '/';
  const shouldShowNavbar = !isRoomPage && !isAuthPage;

  // Settings modal state
  const showSettingsModal = searchParams.get('settings') === 'true';
  const closeSettingsModal = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('settings');
    setSearchParams(newParams);
  };

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
    <div className="relative flex flex-col">
      <div className="relative z-50">
        <div className="fixed h-0 flex flex-row">
          <div className="h-screen">
            {shouldShowNavbar && (
              <Navbar
                isMobileMenuOpen={isMobileMenuOpen}
                setIsMobileMenuOpen={setIsMobileMenuOpen}
              />
            )}
          </div>
          {shouldShowNavbar && (
            <div className="bg-background/80 backdrop-blur h-fit w-screen p-2">
              <Breadcrumb
                currentPath={location.pathname}
                isMobileMenuOpen={isMobileMenuOpen}
                setIsMobileMenuOpen={setIsMobileMenuOpen}
              />
            </div>
          )}
        </div>
      </div>

      <main className="flex-1">
        <div className="relative z-20">
          <Outlet />
        </div>
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
  );
};

export default Layout;
