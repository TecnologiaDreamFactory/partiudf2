'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

interface AppShellProps {
  title?: string;
  /** Conteúdo à direita do header (avatar, ações). */
  actions?: ReactNode;
  /** Badge curto antes do título (ex.: status de viagem). */
  badge?: ReactNode;
  /** Conteúdo da página. */
  children: ReactNode;
  /** Largura máxima do container. Default: 2xl. */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  /** Permite que children ocupem largura total (mapa em /p). */
  fullBleed?: boolean;
}

const MAX_W: Record<NonNullable<AppShellProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
};

export function AppShell({
  title,
  actions,
  badge,
  children,
  maxWidth = '2xl',
  fullBleed = false,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-df-surface-2">
      <header className="sticky top-0 z-30 border-b border-df-border bg-df-surface/85 backdrop-blur supports-[backdrop-filter]:bg-df-surface/70">
        <div
          className={cn(
            'mx-auto flex h-14 items-center gap-3 px-4 sm:h-16 sm:px-6',
            MAX_W[maxWidth],
          )}
        >
          <Link
            href="/"
            aria-label="Página inicial"
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-df-blue/40 rounded-md"
          >
            <Logo className="h-8 w-8" />
            <span className="hidden text-sm font-semibold text-df-ink sm:inline">
              PARTIU DF
            </span>
          </Link>
          {(title || badge) && (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="text-df-border" aria-hidden>
                /
              </span>
              {badge}
              {title && (
                <h1 className="truncate text-base font-semibold text-df-ink sm:text-lg">
                  {title}
                </h1>
              )}
            </div>
          )}
          {!title && !badge && <div className="flex-1" />}
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        className={cn(
          'mx-auto animate-fade-in',
          fullBleed ? 'w-full' : cn('px-4 py-4 sm:px-6 sm:py-6', MAX_W[maxWidth]),
        )}
      >
        {children}
      </main>
    </div>
  );
}
