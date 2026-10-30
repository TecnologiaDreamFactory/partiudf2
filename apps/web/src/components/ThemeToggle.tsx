'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <span
        aria-hidden
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-lg border border-df-border bg-df-surface',
          className,
        )}
      />
    );
  }

  const isDark = resolvedTheme === 'dark';
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg border border-df-border bg-df-surface text-df-ink',
        'transition-colors hover:bg-df-surface-2 hover:text-df-blue',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-df-blue/40',
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
