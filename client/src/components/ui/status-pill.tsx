import React from 'react';
import { cn } from '@/lib/utils';

export type StatusPillVariant = 'neutral' | 'accent' | 'live' | 'warm' | 'danger';

interface StatusPillProps {
  children: React.ReactNode;
  variant?: StatusPillVariant;
  className?: string;
  icon?: React.ReactNode;
}

export const StatusPill = ({
  children,
  variant = 'neutral',
  className,
  icon,
}: StatusPillProps) => {
  const variantStyles: Record<StatusPillVariant, string> = {
    neutral: 'bg-surface-sunken text-ink-faint border border-border/50',
    accent: 'bg-primary/10 text-primary border border-primary/20',
    live: 'bg-live/10 text-live border border-live/20',
    warm: 'bg-warm/10 text-warm border border-warm/20',
    danger: 'bg-danger/10 text-danger border border-danger/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
        variantStyles[variant],
        className
      )}
    >
      {icon && <span className="mr-1">{icon}</span>}
      {children}
    </span>
  );
};

export default StatusPill;
