'use client';

import { forwardRef, useImperativeHandle, useRef, type HTMLAttributes } from 'react';
import { useReveal } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Bloco do guide: sem sombra, linha translucida, raio grande. Entra com reveal (GSAP). */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const inner = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => inner.current!);
    useReveal(inner);
    return (
      <div
        ref={inner}
        className={cn(
          'rounded-[22px] border border-df-border bg-df-surface p-5 sm:p-6',
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('mb-4 flex items-start justify-between gap-3', className)}
      {...props}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn('text-xl text-df-ink sm:text-2xl', className)} {...props} />
  ),
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('mt-1.5 text-[15px] text-df-muted', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';
