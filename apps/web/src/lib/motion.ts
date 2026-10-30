'use client';

import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

/** Easing do guide: cubic-bezier(.22,1,.36,1) ≈ power3.out / expo.out. */
export const EASE = 'power3.out';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Elementos que montam no mesmo frame entram em cascata: cada um pega o
// proximo degrau e o contador zera no frame seguinte.
let queued = 0;

/** Entrada do guide (.reveal): sobe 26px e aparece. Irmaos montados juntos entram em stagger. */
export function useReveal(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    if (queued++ === 0) requestAnimationFrame(() => (queued = 0));
    const tween = gsap.from(el, {
      autoAlpha: 0,
      y: 26,
      duration: 0.85,
      delay: (queued - 1) * 0.07,
      ease: EASE,
      clearProps: 'transform,opacity,visibility',
    });
    return () => {
      tween.kill();
    };
  }, [ref]);
}

export { gsap, ScrollTrigger };
