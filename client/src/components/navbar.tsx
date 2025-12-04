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
      <header className="border-b border-border/50 bg-background/95 backdrop-blur-md sticky top-0 z-30 shadow-sm">
        <div className="relative z-20 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5 max-w-7xl mx-auto">
          <Logo variant="gradient" />

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-all duration-200 relative group"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(link.href.replace('#', ''));
                }}
              >
                {link.label}
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left"></span>
              </a>
            ))}
          </nav>

          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Theme Toggle - Landing variant */}
            <ThemeToggle variant="landing" />

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden rounded-lg hover:bg-muted"
              onClick={toggleMobileMenu}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-foreground" />
              ) : (
                <Menu className="w-5 h-5 text-foreground" />
              )}
            </Button>

            {/* Desktop Login Button */}
            <Link to={isLoginPage ? '/signup' : '/login'}>
              <Button className="hidden lg:flex bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-5 py-2 text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200">
                {isLoginPage ? 'Sign Up' : 'Login'}{' '}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`lg:hidden absolute top-full left-0 right-0 z-20 bg-background/98 backdrop-blur-md border-b border-border shadow-lg transition-all duration-300 ease-in-out ${
            isMobileMenuOpen
              ? 'opacity-100 transform translate-y-0'
              : 'opacity-0 transform -translate-y-4 pointer-events-none'
          }`}
        >
          <nav className="flex flex-col px-4 py-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all duration-200"
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
              className="w-full mt-2"
              onClick={closeMobileMenu}
            >
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 w-full text-sm font-medium shadow-sm">
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
