import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Flat design: no shadow, bottom-border-focused feel
          'flex h-9 w-full rounded-xl border border-input bg-surface-sunken px-3 py-2',
          'text-sm text-foreground tracking-[-0.01em]',
          'placeholder:text-muted-foreground/60',
          'transition-colors duration-150',
          // No shadow — crisp border focus only
          'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-0',
          'disabled:cursor-not-allowed disabled:opacity-40',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
