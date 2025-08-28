import { NAVIGATION_ITEMS } from '@/lib/constants';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { ArrowLeft, Menu } from 'lucide-react';

const Breadcrumb = ({
  currentPath,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}: {
  currentPath: string;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isMobileMenuOpen: boolean) => void;
}) => {
  const navigate = useNavigate();
  const currentItem = NAVIGATION_ITEMS.find(
    (item) => item.path === currentPath
  );

  if (!currentItem) return null;

  return (
    <div className="flex items-center gap-2 text-sm ">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </div>

      <div className="flex items-center justify-center gap-2 py-1 text-lg text-foreground">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="hover:bg-transparent cursor-pointer flex items-center justify-center gap-2 h-auto font-medium text-xs uppercase"
        >
          {currentPath !== '/dashboard' && (
            <>
              <ArrowLeft className="h-4 w-4" />
            </>
          )}
          <p>Dashboard</p>
          {currentPath !== '/dashboard' && (
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
