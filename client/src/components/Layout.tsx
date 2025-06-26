import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';

const Layout = () => {
  const location = useLocation();
  const isRoomPage = location.pathname.startsWith('/room/');

  return (
    <div className="min-h-screen flex flex-col">
      {!isRoomPage && <Navbar />}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
