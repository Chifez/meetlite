import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CollaborationSettingsPanel } from '@/components/room/collaboration/collaboration-settings-panel';
import { type MenuItem } from '@/hooks/use-collaboration-menu-items';

interface RadialMenuItemProps {
  item: MenuItem;
  position: { x: number; y: number };
  isOpen: boolean;
  isDisabled: boolean;
  index: number;
}

export const RadialMenuItem = ({
  item,
  position,
  isOpen,
  isDisabled,
  index,
}: RadialMenuItemProps) => {
  const Icon = item.icon;

  const buttonStyles = {
    left: '50%',
    top: '50%',
    transform: isOpen
      ? `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`
      : 'translate(-50%, -50%)',
    transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
  };

  const buttonClasses = cn(
    'absolute rounded-full h-8 w-8 pointer-events-auto transition-all duration-300',
    isDisabled && 'opacity-50 cursor-not-allowed',
    isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
  );

  // Settings button with popover
  if (item.isPopover) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            title={item.title}
            className={buttonClasses}
            style={buttonStyles}
          >
            <Icon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80 p-0"
          align="end"
          side="top"
          sideOffset={20}
        >
          <CollaborationSettingsPanel />
        </PopoverContent>
      </Popover>
    );
  }

  // Regular button
  return (
    <Button
      variant={item.isActive ? 'default' : 'outline'}
      size="icon"
      onClick={item.onClick}
      title={item.title}
      className={buttonClasses}
      style={buttonStyles}
      disabled={Boolean(isDisabled)}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
};
