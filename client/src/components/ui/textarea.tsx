import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-xl border border-input bg-surface-sunken px-3 py-2',
          'text-sm text-foreground tracking-[-0.01em] leading-relaxed',
          'placeholder:text-muted-foreground/60',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-0',
          'disabled:cursor-not-allowed disabled:opacity-40 resize-none',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
