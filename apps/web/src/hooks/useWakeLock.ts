'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * Mantém a tela acordada enquanto `active` é true, para o celular não dormir e
 * cortar o GPS do motorista. Devolve se a tela está de fato presa.
 *
 * 1. Screen Wake Lock API; se o sistema soltar com a tela visível, pede de novo.
 * 2. Plano B: vídeo mudo em loop (public/keep-awake.mp4). Vídeo tocando segura a
 *    tela onde a API não existe ou é recusada (iOS < 16.4, modo economia, PWA antigo).
 *
 * Nada disso funciona se o motorista trocar de app ou bloquear a tela: o navegador
 * pausa a página. Por isso avisa quando ele volta.
 */
export function useWakeLock(active: boolean): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!active || typeof navigator === 'undefined') return;
    let disposed = false;
    let sentinel: Awaited<ReturnType<Navigator['wakeLock']['request']>> | null = null;
    let video: HTMLVideoElement | null = null;

    const playVideo = async () => {
      if (!video) {
        video = document.createElement('video');
        video.src = '/keep-awake.mp4';
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('aria-hidden', 'true');
        video.style.cssText =
          'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
        document.body.appendChild(video);
      }
      try {
        await video.play();
        return true;
      } catch {
        return false;
      }
    };

    const acquire = async () => {
      if (disposed || document.visibilityState !== 'visible') return;
      if ('wakeLock' in navigator) {
        try {
          const s = await navigator.wakeLock.request('screen');
          if (disposed) return void s.release().catch(() => {});
          sentinel = s;
          s.addEventListener('release', () => {
            sentinel = null;
            setHeld(false);
            void acquire(); // aba oculta ou cleanup: acquire sai sem fazer nada
          });
          video?.pause();
          setHeld(true);
          return;
        } catch {
          // recusado (bateria baixa, modo economia...): tenta o vídeo
        }
      }
      setHeld(await playVideo());
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      toast.warning('Você saiu do app: a localização ficou pausada. Mantenha esta tela aberta.');
      void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => {});
      if (video) {
        video.pause();
        video.remove();
      }
      setHeld(false);
    };
  }, [active]);

  return held;
}
