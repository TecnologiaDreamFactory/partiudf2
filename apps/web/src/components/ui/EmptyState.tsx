import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-2 py-8 text-center', className)}>
      {icon && (
        <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-df-blue-soft text-df-blue">
          {icon}
        </div>
      )}
      <h3 className="text-2xl text-df-ink">{title}</h3>
      {description && (
        <p className="mt-2 max-w-[34ch] text-[15px] text-df-muted">{description}</p>
      )}
      {action && <div className="mt-6 w-full sm:w-auto">{action}</div>}
    </div>
  );
}
