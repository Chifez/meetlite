import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import ThemeToggle from './ThemeToggle';
import Logo from './Logo';
import { ArrowRight, ArrowRightIcon, Menu, X, Video } from 'lucide-react';

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
  const isLandingPage = location.pathname === '/';
  const [menuOpen, setMenuOpen] = useState(false);

  // Landing page specific state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Landing page navbar design
  if (isLandingPage) {
    return (
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Video className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              meetlite
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(link.href.replace('#', ''));
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Theme Toggle - Landing variant */}
            <ThemeToggle variant="landing" />

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={toggleMobileMenu}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              ) : (
                <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              )}
            </Button>

            {/* Desktop Login Button */}
            <Link to={isLoginPage ? '/signup' : '/login'}>
              <Button className="hidden md:flex bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full px-6 text-base">
                {isLoginPage ? 'Sign Up' : 'Login'}{' '}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
            <nav className="flex flex-col space-y-4 px-6 py-6">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(link.href.replace('#', ''));
                    setIsMobileMenuOpen(false);
                  }}
                >
                  {link.label}
                </a>
              ))}
              <Link to={isLoginPage ? '/signup' : '/login'} className="w-full">
                <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full px-6 mt-4 w-full">
                  {isLoginPage ? 'Sign Up' : 'Login'}{' '}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </nav>
          </div>
        )}
      </header>
    );
  }

  // Main app navbar design (using commented-out logic)
  return (
    <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-30">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Logo size="sm" />
        </Link>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle variant="default" />
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
          <div className="flex flex-col gap-4 items-center w-full max-w-xs">
            <ThemeToggle variant="default" />
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
