import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'glass-field flex min-h-[80px] w-full rounded-lg bg-input px-4 py-3 text-base text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 focus:bg-transparent resize-none',
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
