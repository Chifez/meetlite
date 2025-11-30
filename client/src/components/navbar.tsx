import Logo from './logo';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Sidebar } from './sidebar/sidebar';
import { NAV_LINKS } from '@/lib/constants';
import { useAuth } from '@/hooks/use-auth';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './theme-toggle';
import { Button } from './ui/button';

const scrollToSection = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

const Navbar = ({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}: {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isMobileMenuOpen: boolean) => void;
}) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const isLoginPage = location.pathname === '/login';
  const isLandingPage = location.pathname === '/';

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Landing page navbar design
  if (isLandingPage) {
    return (
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-4 max-w-7xl mx-auto">
          <Logo variant="gradient" />

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
              <Button className="hidden md:flex bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6 text-sm">
                {isLoginPage ? 'Sign Up' : 'Login'}{' '}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`md:hidden absolute top-16 left-0 right-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out ${
            isMobileMenuOpen
              ? 'opacity-100 transform translate-y-0'
              : 'opacity-0 transform -translate-y-4 pointer-events-none'
          }`}
        >
          <nav className="flex flex-col space-y-4 px-6 py-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(link.href.replace('#', ''));
                  closeMobileMenu();
                }}
              >
                {link.label}
              </a>
            ))}
            <Link
              to={isLoginPage ? '/signup' : '/login'}
              className="w-full"
              onClick={closeMobileMenu}
            >
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6 mt-4 w-full text-sm">
                {isLoginPage ? 'Sign Up' : 'Login'}{' '}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>
    );
  }

  // For room pages and other authenticated pages, show sidebar without navbar
  if (isAuthenticated) {
    return (
      <>
        <Sidebar
          mobileMenuOpen={isMobileMenuOpen}
          setMobileMenuOpen={setIsMobileMenuOpen}
        />
      </>
    );
  }
};

export default Navbar;
