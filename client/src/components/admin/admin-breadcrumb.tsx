import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Menu } from 'lucide-react';
import { ADMIN_NAVIGATION_ITEMS } from '@/lib/admin-constants';

interface AdminBreadcrumbProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isMobileMenuOpen: boolean) => void;
}

const AdminBreadcrumb = ({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}: AdminBreadcrumbProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Find current admin page
  const currentItem = ADMIN_NAVIGATION_ITEMS.find(
    (item) => item.path === location.pathname
  );
  const isOverview = location.pathname === '/admin';

  // Show breadcrumb for admin pages
  if (!currentItem && location.pathname !== '/admin') return null;

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-2">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}
        </div>

        <div className="flex items-center justify-center gap-2 py-1 text-lg text-foreground">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin')}
            className="hover:bg-transparent cursor-pointer flex items-center justify-center gap-2 h-auto font-medium text-xs uppercase"
          >
            {!isOverview && (
              <>
                <ArrowLeft className="h-4 w-4" />
              </>
            )}
            <p>Admin</p>
            {!isOverview && currentItem && (
              <>
                <span>/</span>
                <span>{currentItem.label}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminBreadcrumb;
