import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui/badge';
import { cn } from '../../lib/utils';

interface HotkeyIndicatorProps {
  hotkey: string;
  className?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export const HotkeyIndicator: React.FC<HotkeyIndicatorProps> = ({
  hotkey,
  className,
  variant = 'outline',
}) => {
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keys = hotkey
        .toLowerCase()
        .split('+')
        .map((k) => k.trim());
      const isMatch = keys.every((key) => {
        switch (key) {
          case 'ctrl':
            return event.ctrlKey;
          case 'alt':
            return event.altKey;
          case 'shift':
            return event.shiftKey;
          case 'cmd':
          case 'meta':
            return event.metaKey;
          default:
            return event.key.toLowerCase() === key;
        }
      });

      if (isMatch) {
        setIsPressed(true);
        setTimeout(() => setIsPressed(false), 150);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hotkey]);

  return (
    <Badge
      variant={variant}
      className={cn(
        'font-mono text-xs transition-all duration-150',
        isPressed && 'scale-95 bg-primary text-primary-foreground',
        className
      )}
    >
      {hotkey}
    </Badge>
  );
};

// Component for showing hotkey hints on buttons
interface HotkeyHintProps {
  hotkey: string;
  children: React.ReactNode;
  className?: string;
}

export const HotkeyHint: React.FC<HotkeyHintProps> = ({
  hotkey,
  children,
  className,
}) => {
  return (
    <div className={cn('relative group', className)}>
      {children}
      <HotkeyIndicator
        hotkey={hotkey}
        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>
  );
};
