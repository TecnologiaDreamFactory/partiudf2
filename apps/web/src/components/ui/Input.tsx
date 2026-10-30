import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/** Rotulo no estilo .tag do guide; campo com 16px (abaixo disso o iOS da zoom ao focar). */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const reactId = useId();
    const inputId = id ?? `input-${reactId}`;
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-2 block text-xs font-semibold uppercase tracking-tag text-df-muted"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(
            'h-[52px] w-full rounded-2xl border-[1.5px] bg-df-surface px-4 text-base text-df-ink',
            'placeholder:text-df-muted/70 transition-colors duration-300 ease-df',
            'focus:outline-none focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-60',
            error ? 'border-df-danger' : 'border-df-border focus:border-df-blue',
            className,
          )}
          {...props}
        />
        {hint && !error && (
          <p id={`${inputId}-hint`} className="mt-2 text-sm text-df-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} role="alert" className="mt-2 text-sm text-df-danger">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';
