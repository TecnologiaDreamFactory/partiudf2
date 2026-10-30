'use client';

import { useLayoutEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface VanLoaderProps {
  /** Mensagem mostrada abaixo da van. */
  message?: string;
  /** Cobre o viewport inteiro (splash). */
  fullScreen?: boolean;
  className?: string;
}

// Predios [x, largura, altura] num viewBox 200x48 — chao em y=48.
const BUILDINGS = [
  [0, 14, 18], [16, 10, 28], [28, 18, 14], [48, 8, 24], [58, 16, 32], [76, 8, 12],
  [124, 12, 20], [138, 18, 26], [158, 10, 16], [170, 16, 30], [188, 12, 20],
] as const;

/** Skyline com o Congresso no meio (torres + cupulas). Duas copias lado a lado = loop sem emenda. */
function Skyline() {
  return (
    <svg viewBox="0 0 200 48" preserveAspectRatio="none" className="h-full w-1/2 shrink-0" fill="currentColor">
      {BUILDINGS.map(([x, w, h]) => (
        <rect key={x} x={x} y={48 - h} width={w} height={h} />
      ))}
      <rect x="99" y="8" width="3" height="32" />
      <rect x="104" y="8" width="3" height="32" />
      <rect x="84" y="40" width="40" height="8" />
      <path d="M86 34h12q-6 8-12 0z" />
      <path d="M110 40q5-8 10 0z" />
    </svg>
  );
}

/** Postes e arbustos da beira da pista. */
function Roadside() {
  return (
    <svg viewBox="0 0 120 48" preserveAspectRatio="none" className="h-full w-1/2 shrink-0" stroke="currentColor" fill="currentColor">
      {[20, 60, 100].map((x) => (
        <g key={x}>
          <path d={`M${x} 48V12h7`} fill="none" strokeWidth="1.2" />
          <circle cx={x + 7} cy="13.5" r="1.6" stroke="none" />
        </g>
      ))}
      <ellipse cx="40" cy="46" rx="6" ry="3.5" stroke="none" />
      <ellipse cx="84" cy="46.5" rx="4" ry="2.5" stroke="none" />
    </svg>
  );
}

/**
 * Loader em GSAP:
 *  1) "partiu df" e revelado e da um pop; o logo entra com mola;
 *  2) a van surge pela direita e fica no centro, andando para a esquerda,
 *     enquanto o mundo passa por ela em parallax (skyline lento, postes,
 *     pista rapida), com linhas de velocidade, fumaca e balanco da suspensao.
 * Com reduced-motion, a cena fica parada.
 */
export function VanLoader({
  message = 'Procurando a van…',
  fullScreen = false,
  className,
}: VanLoaderProps) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const loop = { ease: 'none', repeat: -1 } as const;

      // Cena criada pausada (dentro do context, para ser limpa no unmount).
      const scene = gsap
        .timeline({ paused: true })
        // a van anda para a esquerda, entao o mundo passa para a direita
        .fromTo('[data-sky]', { xPercent: -50 }, { xPercent: 0, duration: 26, ...loop }, 0)
        .fromTo('[data-side]', { xPercent: -50 }, { xPercent: 0, duration: 3.4, ...loop }, 0)
        .to('[data-road]', { backgroundPositionX: '52px', duration: 0.42, ...loop }, 0)
        .to('[data-bob]', { y: -1.5, duration: 0.16, yoyo: true, repeat: -1, ease: 'sine.inOut' }, 0)
        .to('[data-bob]', { rotation: 0.6, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' }, 0)
        .fromTo(
          '[data-speed]',
          { x: 0, opacity: 0 },
          { keyframes: { x: [0, 42], opacity: [0, 0.9, 0], easeEach: 'none' }, duration: 0.55, stagger: { each: 0.18, repeat: -1 } },
          0,
        )
        .fromTo(
          '[data-puff]',
          { x: 0, scale: 0.6, opacity: 0.55 },
          { x: 26, y: -4, scale: 2.4, opacity: 0, duration: 0.9, ease: 'power1.out', stagger: { each: 0.45, repeat: -1 } },
          0,
        );

      gsap
        .timeline()
        .from('[data-word]', { clipPath: 'inset(0 100% 0 0)', duration: 0.9, ease: 'power2.inOut' })
        .to('[data-word]', { keyframes: { scale: [1, 1.12, 0.96, 1.03, 1] }, duration: 0.6 })
        .from('[data-logo]', { scale: 0, autoAlpha: 0, duration: 0.9, ease: 'elastic.out(1,0.45)' }, '<')
        // a van surge pela direita (de tras) e assenta no centro; o mundo acelera junto
        .fromTo(
          '[data-van]',
          { x: () => root.current!.offsetWidth * 0.6, autoAlpha: 0 },
          { x: 0, autoAlpha: 1, duration: 1.4, ease: 'power3.out' },
          '<0.1',
        )
        .add(() => {
          scene.play();
        }, '<')
        .fromTo(scene, { timeScale: 0.15 }, { timeScale: 1, duration: 1.6, ease: 'power2.out' }, '<');

      gsap.to('[data-dot]', {
        opacity: 1,
        duration: 0.45,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        stagger: 0.15,
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={root}
      role="status"
      aria-live="polite"
      aria-label={message}
      className={cn(
        'flex flex-col items-center justify-center gap-12 overflow-hidden px-6',
        fullScreen ? 'fixed inset-0 z-[9999] bg-df-surface-2' : 'w-full py-10',
        className,
      )}
    >
      <div aria-hidden className="flex items-center gap-3 text-df-ink">
        <span data-word className="inline-block text-[44px] leading-none tracking-[-.045em] sm:text-[56px]">
          <span className="font-light">partiu</span>
          <b className="text-grad font-bold">df</b>
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img data-logo src="/logo.png" alt="" draggable={false} className="size-12 select-none object-contain sm:size-14" />
      </div>

      {/* Cena: bordas esmaecidas para tudo surgir e sumir suave */}
      <div
        aria-hidden
        className="relative h-36 w-full max-w-sm overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_14%,#000_86%,transparent)] sm:h-40"
      >
        <div data-sky className="absolute bottom-1 left-0 flex h-[72px] w-[200%] text-df-ink/[.07]">
          <Skyline />
          <Skyline />
        </div>
        <div data-side className="absolute bottom-1 left-0 flex h-12 w-[200%] text-df-ink/20">
          <Roadside />
          <Roadside />
        </div>

        <div className="absolute inset-x-0 bottom-1.5 flex justify-center">
          <div data-van className="relative">
            {/* rastro atras da van (lado direito = traseira) */}
            {[30, 48, 64].map((top) => (
              <span
                key={top}
                data-speed
                className="absolute left-full ml-1 h-[2px] w-7 rounded-full bg-df-blue/60 opacity-0"
                style={{ top: `${top}%` }}
              />
            ))}
            {[0, 1].map((i) => (
              <span
                key={i}
                data-puff
                className="absolute bottom-2 right-1 size-2.5 rounded-full bg-df-muted/30 opacity-0"
              />
            ))}
            <div data-bob>
              {/* van.png ja olha para a esquerda — sem espelhar, o texto da lateral fica legivel */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/van.png"
                alt=""
                draggable={false}
                className="h-[88px] w-auto select-none drop-shadow-[0_6px_8px_rgba(13,14,18,.18)] sm:h-[104px]"
              />
            </div>
          </div>
        </div>

        <div
          data-road
          className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-df-border"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, var(--df-blue) 0 14px, transparent 14px 26px)' }}
        />
      </div>

      <div className="flex items-center gap-2 text-df-muted">
        <span className="text-[15px] lowercase">{message}</span>
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} data-dot aria-hidden className="block size-1.5 rounded-full bg-df-blue opacity-30" />
          ))}
        </span>
      </div>
    </div>
  );
}

/** Splash em tela cheia que sai subindo (como o #loader do guide) quando `show` vira false. */
export function SplashScreen({ show, message }: { show: boolean; message?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || show) return;
    if (prefersReducedMotion()) {
      el.style.display = 'none';
      return;
    }
    const tween = gsap.to(el, {
      yPercent: -100,
      duration: 0.85,
      ease: 'expo.inOut',
      onComplete: () => {
        el.style.display = 'none';
      },
    });
    return () => {
      tween.kill();
    };
  }, [show]);

  return (
    <div ref={ref} className="fixed inset-0 z-[9999] flex bg-df-surface-2">
      <VanLoader message={message} />
    </div>
  );
}
