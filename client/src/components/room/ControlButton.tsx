import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface ControlButtonProps {
  icon: LucideIcon;
  iconAlt?: LucideIcon;
  onClick: () => void;
  isActive?: boolean;
  isDestructive?: boolean;
  disabled?: boolean;
  className?: string;
}

export const ControlButton = ({
  icon: Icon,
  iconAlt: IconAlt,
  onClick,
  isActive = false,
  isDestructive = false,
  disabled = false,
  className = '',
}: ControlButtonProps) => {
  const activeState = Boolean(isActive);

  const getVariantStyles = () => {
    if (isDestructive) {
      return 'bg-destructive text-destructive-foreground hover:bg-destructive/90';
    }
    if (activeState) {
      return 'bg-accent text-accent-foreground hover:bg-accent/90';
    }
    if (!activeState && IconAlt) {
      return 'bg-destructive text-destructive-foreground hover:bg-destructive/90';
    }
    return '';
  };

  return (
    <Button
      variant={isDestructive ? 'destructive' : 'outline'}
      size="icon"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full h-12 w-12 transition-colors ${getVariantStyles()} ${className}`}
    >
      {IconAlt && !activeState ? (
        <IconAlt className="h-5 w-5" />
      ) : (
        <Icon className="h-5 w-5" />
      )}
    </Button>
  );
};
