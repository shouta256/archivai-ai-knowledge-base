import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 backdrop-blur-sm',
        {
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80': variant === 'default',
          'bg-secondary text-secondary-foreground border border-border/70 hover:bg-secondary/80': variant === 'secondary',
          'text-foreground': variant === 'outline',
          // Note: 'outline' style usually needs a border class applied via className if not default
        },
        // Apply border only for outline variant if needed, or rely on caller
        variant === 'outline' ? 'border border-border' : '',
        className
      )}
      {...props}
    />
  );
}

export { Badge };
