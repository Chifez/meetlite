import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import ThemeToggle from './ThemeToggle';
import Logo from './Logo';

const Navbar = () => {
  const { isAuthenticated, logout } = useAuth();

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Logo size="sm" />
        </Link>

        <div className="flex items-center gap-4">
          <ThemeToggle />

          {isAuthenticated ? (
            <Button variant="ghost" onClick={logout}>
              Logout
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost">Login</Button>
              </Link>
              <Link to="/signup">
                <Button>Sign Up</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
