import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';

const Layout = () => {
  const location = useLocation();
  const isRoomPage = location.pathname.startsWith('/room/');
  const isAuthPage =
    location.pathname === '/login' || location.pathname === '/signup';
  const shouldShowNavbar = !isRoomPage && !isAuthPage;

  return (
    <div className="flex flex-col">
      {shouldShowNavbar && <Navbar />}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
