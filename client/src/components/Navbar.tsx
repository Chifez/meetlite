import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import ThemeToggle from './ThemeToggle';
import Logo from './Logo';
import { ArrowRightIcon } from 'lucide-react';

const Navbar = () => {
  const { isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Logo size="sm" />
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {isAuthenticated && (
            <Link to="/meetings">
              <Button variant="ghost">Meetings</Button>
            </Link>
          )}

          {isAuthenticated ? (
            <Button variant="ghost" onClick={logout}>
              Logout
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Link to={isLoginPage ? '/signup' : '/login'}>
                <Button className="flex items-center gap-2">
                  {isLoginPage ? 'Sign Up' : 'Login'}
                  <ArrowRightIcon className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
