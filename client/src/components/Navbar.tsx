import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import ThemeToggle from './ThemeToggle';
import Logo from './Logo';
import { ArrowRightIcon, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Contact', href: '#contact' },
];

const scrollToSection = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

const Navbar = () => {
  const { isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isDashboard = location.pathname.startsWith('/dashboard');
  const [menuOpen, setMenuOpen] = useState(false);

  const showNavLinks = !isDashboard;

  return (
    <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-30">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Logo size="sm" />
        </Link>
        {/* Desktop Nav */}
        {showNavLinks && (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="hover:text-primary transition-colors cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(link.href.replace('#', ''));
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}
        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-2">
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
            <Link to={isLoginPage ? '/signup' : '/login'}>
              <Button className="flex items-center gap-2">
                {isLoginPage ? 'Sign Up' : 'Login'}
                <ArrowRightIcon className="w-4 h-4" />
              </Button>
            </Link>
          )}
        </div>
        {/* Hamburger for mobile */}

        <button
          className="md:hidden ml-2 p-2 rounded hover:bg-muted focus:outline-none"
          onClick={() => setMenuOpen((m) => !m)}
          aria-label="Open menu"
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 top-16 min-h-screen bg-background/95 flex flex-col items-center justify-center md:hidden fade-in fade-out">
          {showNavLinks && (
            <nav className="flex flex-col gap-8 items-center text-lg font-semibold mb-8">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="hover:text-primary transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(link.href.replace('#', ''));
                    setMenuOpen(false);
                  }}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}
          <div className="flex flex-col gap-4 items-center w-full max-w-xs">
            <ThemeToggle />
            {isAuthenticated && (
              <Link to="/meetings" className="w-full">
                <Button variant="ghost" className="w-full">
                  Meetings
                </Button>
              </Link>
            )}
            {isAuthenticated ? (
              <Button variant="ghost" className="w-full" onClick={logout}>
                Logout
              </Button>
            ) : (
              <Link to={isLoginPage ? '/signup' : '/login'} className="w-full">
                <Button className="flex items-center gap-2 w-full">
                  {isLoginPage ? 'Sign Up' : 'Login'}
                  <ArrowRightIcon className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
