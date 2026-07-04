import { LucideIcon } from 'lucide-react';

interface ControlButtonProps {
  icon: LucideIcon;
  iconAlt?: LucideIcon;
  onClick: () => void;
  isActive?: boolean;
  isDestructive?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
  children?: React.ReactNode;
}

export const ControlButton = ({
  icon: Icon,
  iconAlt: IconAlt,
  onClick,
  isActive = false,
  isDestructive = false,
  disabled = false,
  className = '',
  title,
  children,
}: ControlButtonProps) => {
  const activeState = Boolean(isActive);

  const getVariantStyles = () => {
    if (isDestructive) {
      return 'bg-rose-600 hover:bg-rose-500 text-white border-transparent';
    }
    if (activeState) {
      return 'bg-primary hover:bg-primary/95 text-white border-transparent';
    }
    // Muted/disabled media state
    if (!activeState && IconAlt) {
      return 'bg-zinc-800 hover:bg-zinc-700 text-rose-400 border-zinc-700/80';
    }
    return 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800';
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold tracking-[-0.01em] transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 rounded-xl h-10 border ${
        children ? 'px-4' : 'w-10'
      } ${getVariantStyles()} ${className}`}
      title={title}
    >
      {IconAlt && !activeState ? (
        <IconAlt className="h-4.5 w-4.5" />
      ) : (
        <>
          <Icon className="h-4.5 w-4.5" />
          {children}
        </>
      )}
    </button>
  );
};
