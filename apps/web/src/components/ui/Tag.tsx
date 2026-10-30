import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Numeracao editorial do guide (.tag): caixa alta, barra azul em cima. */
export function Tag({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-block w-fit border-t-2 border-df-blue pt-2.5 text-xs font-semibold uppercase tracking-tag text-df-blue',
        className,
      )}
      {...props}
    />
  );
}
