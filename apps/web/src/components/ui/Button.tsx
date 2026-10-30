import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonStyles = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'rounded-xl font-medium transition-all',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'active:scale-[0.98] active:transition-none',
    'select-none',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-df-blue text-white shadow-soft hover:bg-df-blue-dark focus-visible:ring-df-blue',
        ghost:
          'bg-transparent border border-df-border text-df-ink hover:bg-df-surface-2 focus-visible:ring-df-blue',
        outline:
          'bg-transparent border border-df-blue text-df-blue hover:bg-df-blue-soft focus-visible:ring-df-blue',
        danger:
          'border border-red-200 bg-white text-df-danger hover:bg-red-50 focus-visible:ring-red-300',
        dangerSolid:
          'bg-df-danger text-white hover:bg-red-700 focus-visible:ring-red-300',
        subtle:
          'bg-df-blue-soft text-df-blue hover:bg-sky-100 focus-visible:ring-df-blue',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-base',
        lg: 'h-12 px-5 text-base',
        icon: 'h-11 w-11',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
        responsive: 'w-full sm:w-auto',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: 'responsive',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, fullWidth, isLoading, children, disabled, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonStyles({ variant, size, fullWidth }), className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <span
            aria-hidden
            className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
