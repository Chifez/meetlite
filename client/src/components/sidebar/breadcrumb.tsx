import { NAVIGATION_ITEMS } from '@/lib/constants';
import { Button } from '../ui/button';
import { Menu } from 'lucide-react';

const Breadcrumb = ({
  currentPath,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}: {
  currentPath: string;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isMobileMenuOpen: boolean) => void;
}) => {
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

      <span className="text-foreground font-medium text-xl">
        {currentItem.label}
      </span>
    </div>
  );
};

export default Breadcrumb;
