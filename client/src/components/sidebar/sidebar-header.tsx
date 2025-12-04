import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Logo from '@/components/logo';

interface SidebarHeaderProps {
  collapsed: boolean;
  isDesktop: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onToggleHover?: () => void;
  onToggleLeave?: () => void;
}

export function SidebarHeader({
  collapsed,
  isDesktop,
  onToggleCollapse,
  onCloseMobile,
  onToggleHover,
  onToggleLeave,
}: SidebarHeaderProps) {
  const showLogo = !(collapsed && isDesktop);

  return (
    <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
      {showLogo && (
        <div className="flex items-center gap-2">
          <Logo />
        </div>
      )}
      <div className="lg:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCloseMobile}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      <div className="hidden lg:block">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          onMouseEnter={collapsed ? onToggleHover : undefined}
          onMouseLeave={collapsed ? onToggleLeave : undefined}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
