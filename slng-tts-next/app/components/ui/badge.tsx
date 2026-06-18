import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from './lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-normal font-mono tracking-[-0.072px] leading-4 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow',
        secondary: 'bg-secondary text-secondary-foreground',
        success: 'bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/30',
        warning: 'bg-amber-500/10 text-amber-600 ring-1 ring-inset ring-amber-500/30',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        // Outlined status variants with colored borders (matching Figma design - no background)
        'status-active': 'bg-transparent text-emerald-700 border-emerald-700',
        'status-pending': 'bg-transparent text-amber-600 border-amber-600',
        'status-expired': 'bg-transparent text-red-600 border-red-600',
        'status-revoked': 'bg-transparent text-muted-foreground border-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
));
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
