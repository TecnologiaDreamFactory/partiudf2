'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { ScrollTrigger } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface AppShellProps {
  title?: string;
  /** Conteúdo à direita do header (avatar, ações). */
  actions?: ReactNode;
  /** Badge curto ao lado do título (ex.: status de viagem). */
  badge?: ReactNode;
  children: ReactNode;
  /** Largura máxima do container. Default: 2xl. */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  /** Permite que children ocupem largura total. */
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
  const navRef = useRef<HTMLElement>(null);

  // Nav do guide: ganha fundo ao sair do topo e some ao descer (devolve tela no celular).
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const st = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        const y = self.scroll();
        nav.classList.toggle('is-stuck', y > 8);
        nav.classList.toggle('-translate-y-full', self.direction === 1 && y > 240);
      },
    });
    return () => st.kill();
  }, []);

  return (
    <div className="min-h-svh bg-df-surface-2">
      <header
        ref={navRef}
        className={cn(
          'sticky top-0 z-30 transition-[transform,background-color,box-shadow] duration-500 ease-df',
          'bg-df-surface-2 [&.is-stuck]:bg-[var(--df-nav-bg)] [&.is-stuck]:shadow-[0_1px_0_var(--df-border)] [&.is-stuck]:backdrop-blur-md',
        )}
      >
        <div className={cn('mx-auto flex h-16 items-center gap-3 px-4 sm:px-6', MAX_W[maxWidth])}>
          <Link
            href="/"
            aria-label="PARTIU DF — início"
            className="flex shrink-0 items-center gap-2.5 text-[20px] leading-none tracking-[-.04em] text-df-ink"
          >
            <Logo className="size-8" />
            <span className={cn(title || badge ? 'hidden sm:inline' : 'inline')}>
              <span className="font-light">partiu</span>
              <b className="font-bold">df</b>
            </span>
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            {title && <h1 className="truncate text-lg text-df-ink">{title}</h1>}
            {badge}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {actions}
          </div>
        </div>
      </header>

      <main
        className={cn(
          'mx-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]',
          fullBleed ? 'w-full' : cn('px-4 pt-2 sm:px-6 sm:pt-4', MAX_W[maxWidth]),
        )}
      >
        {children}
      </main>
    </div>
  );
}
