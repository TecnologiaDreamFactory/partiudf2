import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Botao pilula do guide (.btn): o preenchimento sobe de baixo.
 * No celular nao ha hover, entao o mesmo preenchimento sobe no toque (:active).
 */
const buttonStyles = cva(
  [
    'relative isolate inline-flex items-center justify-center gap-2 overflow-hidden',
    'rounded-full border-[1.5px] font-semibold lowercase tracking-[-.01em] select-none',
    'transition-colors duration-300 ease-df',
    // preenchimento que sobe (::before)
    'before:absolute before:inset-0 before:-z-10 before:translate-y-[101%] before:content-[""]',
    'before:transition-transform before:duration-500 before:ease-df',
    'hover:before:translate-y-0 active:before:translate-y-0 active:before:duration-150',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:before:hidden',
  ].join(' '),
  {
    variants: {
      variant: {
        // cheio: ink → azul (nav__cta do guide)
        primary:
          'border-df-ink bg-df-ink text-df-surface before:bg-df-blue hover:border-df-blue hover:text-white active:border-df-blue active:text-white',
        // contorno: transparente → ink (.btn do guide)
        ghost:
          'border-df-ink text-df-ink before:bg-df-ink hover:text-df-surface active:text-df-surface',
        outline:
          'border-df-blue text-df-blue before:bg-df-blue hover:text-white active:text-white',
        danger:
          'border-df-danger text-df-danger before:bg-df-danger hover:text-white active:text-white',
        dangerSolid:
          'border-df-danger bg-df-danger text-white before:bg-df-ink hover:border-df-ink active:border-df-ink',
        subtle:
          'border-transparent bg-df-blue-soft text-df-blue before:bg-df-blue hover:text-white active:text-white',
      },
      size: {
        sm: 'h-10 px-4 text-sm',
        md: 'h-12 px-6 text-base',
        lg: 'h-14 px-8 text-[17px]',
        icon: 'size-12',
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
  ({ className, variant, size, fullWidth, isLoading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonStyles({ variant, size, fullWidth }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
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
  ),
);
Button.displayName = 'Button';
