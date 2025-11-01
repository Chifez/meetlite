import { useCallback } from 'react';
import { NAVIGATION_ITEMS } from '@/lib/constants';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Menu } from 'lucide-react';

interface BreadcrumbProps {
  currentPath: string;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isMobileMenuOpen: boolean) => void;
}

const Breadcrumb = ({
  currentPath,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}: BreadcrumbProps) => {
  const navigate = useNavigate();

  // Simple derived values (no memoization needed for tiny operations)
  const currentItem = NAVIGATION_ITEMS.find(
    (item) => item.path === currentPath
  );
  const isDashboard = currentPath === '/dashboard';

  // Stable handler for toggling mobile menu
  const handleToggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  }, [isMobileMenuOpen, setIsMobileMenuOpen]);

  // Stable handler for closing mobile menu
  const handleCloseMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, [setIsMobileMenuOpen]);

  // Stable handler for navigating to dashboard
  const handleGoToDashboard = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  if (!currentItem) return null;

  return (
    <div className="flex items-center gap-2 text-sm ">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={handleToggleMobileMenu}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 lg:hidden"
            onClick={handleCloseMobileMenu}
          />
        )}
      </div>

      <div className="flex items-center justify-center gap-2 py-1 text-lg text-foreground">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGoToDashboard}
          className="hover:bg-transparent cursor-pointer flex items-center justify-center gap-2 h-auto font-medium text-xs uppercase"
        >
          {!isDashboard && (
            <>
              <ArrowLeft className="h-4 w-4" />
            </>
          )}
          <p>Dashboard</p>
          {!isDashboard && (
            <>
              <span>/</span>
              <span>{currentItem.label}</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Breadcrumb;
