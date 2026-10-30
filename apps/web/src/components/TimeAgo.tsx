'use client';

import { useEffect, useState } from 'react';

/**
 * Mostra "Xs atrás" / "Xmin atrás" auto-atualizando.
 *
 * É isolado em seu próprio componente para que o tick por segundo NÃO
 * dispare re-render no resto da página (evita o "salto" da UI a cada
 * update de GPS).
 */
interface TimeAgoProps {
  /** Timestamp em ms (Date.now()). null = sem dado. */
  from: number | null | undefined;
  /** Texto exibido quando from é nulo. */
  emptyLabel?: string;
  /** Prefixo (ex.: "Última atualização: "). */
  prefix?: string;
  /** Sufixo (ex.: " atrás"). Default: " atrás". */
  suffix?: string;
  className?: string;
}

function formatDelta(deltaMs: number): string {
  const secs = Math.max(0, Math.floor(deltaMs / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  return `${hours}h`;
}

export function TimeAgo({
  from,
  emptyLabel = '—',
  prefix = '',
  suffix = ' atrás',
  className,
}: TimeAgoProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (from == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [from]);

  if (from == null) {
    return <span className={className}>{emptyLabel}</span>;
  }

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}
      {formatDelta(now - from)}
      {suffix}
    </span>
  );
}
