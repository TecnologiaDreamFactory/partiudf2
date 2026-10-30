import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeStyles = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        brand: 'bg-df-blue-soft text-df-blue',
        neutral: 'bg-df-surface-2 text-df-muted border border-df-border',
        success: 'bg-emerald-50 text-emerald-700',
        warning: 'bg-amber-50 text-amber-700',
        danger: 'bg-red-50 text-df-danger',
        live: 'bg-emerald-500/10 text-emerald-700 before:size-1.5 before:rounded-full before:bg-emerald-500 before:animate-pulse',
      },
    },
    defaultVariants: { variant: 'brand' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeStyles> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeStyles({ variant }), className)} {...props} />;
}
