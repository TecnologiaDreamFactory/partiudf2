import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** Pilula do guide (.pills). Cores via tokens → funcionam no dark. */
const badgeStyles = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold lowercase',
  {
    variants: {
      variant: {
        brand: 'bg-df-blue-soft text-df-blue',
        neutral: 'border border-df-border text-df-muted',
        success: 'bg-df-success/10 text-df-success',
        warning: 'bg-df-warning/10 text-df-warning',
        danger: 'bg-df-danger/10 text-df-danger',
        live: 'bg-df-success/10 text-df-success before:size-1.5 before:animate-pulse before:rounded-full before:bg-df-success before:content-[""]',
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
