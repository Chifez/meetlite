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

  // Landing page navbar — flat, crisp, no shadow
  if (isLandingPage) {
    return (
      <header className="border-b border-border/60 bg-background/90 backdrop-blur-xl sticky top-0 z-30">
        <div className="relative z-20 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 max-w-7xl mx-auto">
          <Logo variant="gradient" />

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3.5 py-2 text-[0.8125rem] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-lg transition-all duration-150 tracking-[-0.01em]"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(link.href.replace('#', ''));
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle variant="landing" />

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={toggleMobileMenu}
            >
              {isMobileMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </Button>

            {/* Desktop CTA */}
            <Link to={isLoginPage ? '/signup' : '/login'}>
              <Button
                size="sm"
                className="hidden lg:inline-flex rounded-xl px-4 font-semibold"
              >
                {isLoginPage ? 'Create account' : 'Sign in'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`lg:hidden absolute top-full left-0 right-0 z-20 bg-background/98 backdrop-blur-xl border-b border-border transition-all duration-200 ease-out ${
            isMobileMenuOpen
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-2 pointer-events-none'
          }`}
        >
          <nav className="flex flex-col px-4 py-3 gap-0.5">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg transition-all duration-150 tracking-[-0.01em]"
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
              <Button size="sm" className="w-full rounded-xl font-semibold">
                {isLoginPage ? 'Create account' : 'Sign in'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>
    );
  }

  // Authenticated — render sidebar
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
