import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './navbar';
import Breadcrumb from './sidebar/breadcrumb';
import { useState } from 'react';

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isRoomPage = location.pathname.startsWith('/room/');
  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/signup' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/reset-password' ||
    location.pathname === '/onboarding';
  const isLandingPage = location.pathname === '/';
  const shouldShowNavbar = !isRoomPage && !isAuthPage;

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
      <main className="flex-1 mt-4">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
