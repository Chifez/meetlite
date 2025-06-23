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
      return 'bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive';
    }
    if (activeState) {
      return 'bg-primary text-primary-foreground hover:bg-primary/90 border-primary';
    }
    if (!activeState && IconAlt) {
      return 'bg-muted text-muted-foreground hover:bg-muted/80 border-muted';
    }
    return 'bg-background text-foreground hover:bg-muted border-border';
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full h-12 w-12 transition-all duration-200 ${getVariantStyles()} ${className}`}
    >
      {IconAlt && !activeState ? (
        <IconAlt className="h-5 w-5" />
      ) : (
        <Icon className="h-5 w-5" />
      )}
    </Button>
  );
};
