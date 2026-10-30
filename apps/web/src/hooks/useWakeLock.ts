'use client';

import { useEffect, useRef } from 'react';

/**
 * Mantém a tela acordada enquanto `active` é true.
 * Usa a Screen Wake Lock API (navigator.wakeLock) para evitar que o dispositivo
 * entre em modo de espera e interrompa o compartilhamento de localização.
 *
 * - Re-adquire o lock quando a aba volta a ficar visível (o navegador libera
 *   automaticamente quando a aba vai para background).
 * - Ignora silenciosamente se a API não estiver disponível (ex.: contexto não
 *   seguro, navegador antigo).
 */
type WakeLockSentinelType = Awaited<
  ReturnType<NonNullable<Navigator['wakeLock']>['request']>
>;

export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinelType | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    const requestLock = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        sentinelRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          sentinelRef.current = null;
        });
      } catch {
        // Ignorado: bateria baixa, modo economia, etc.
      }
    };

    const releaseLock = () => {
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(() => {});
        sentinelRef.current = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && active) {
        void requestLock();
      }
    };

    if (active) {
      void requestLock();
      document.addEventListener('visibilitychange', onVisibilityChange);
    } else {
      releaseLock();
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      releaseLock();
    };
  }, [active]);
}
