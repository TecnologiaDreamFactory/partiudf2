'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface VanLoaderProps {
  /** Mensagem mostrada abaixo do van. */
  message?: string;
  /** Mostra o loader em tela cheia (cobre o viewport). */
  fullScreen?: boolean;
  className?: string;
}

const DRAW_DURATION = 0.9; // s para revelar "PARTIU DF" (preenchimento via máscara)

/**
 * Loader animado em duas fases:
 *  1) A marca "PARTIU DF" é ESCRITA traço a traço (contorno das letras
 *     desenhado via stroke-dashoffset), posicionada acima da van.
 *  2) Assim que a escrita termina, a van da PARTIU DF entra rodando da
 *     DIREITA para a ESQUERDA em loop, com a pista pontilhada correndo no
 *     sentido oposto.
 *
 * Tudo em Motion (Framer Motion v12) — hardware-accelerated, sem dependência
 * externa nem CDN, e sem custo de re-render React durante a animação.
 */
export function VanLoader({
  message = 'Procurando a van…',
  fullScreen = false,
  className,
}: VanLoaderProps) {
  // Vira true quando "PARTIU DF" termina de ser escrito.
  const [drawn, setDrawn] = useState(false);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className={cn(
        'flex flex-col items-center justify-center gap-16 sm:gap-24',
        fullScreen
          ? 'fixed inset-0 z-[9999] bg-df-surface-2 backdrop-blur-sm'
          : 'w-full py-10',
        className,
      )}
    >
      {/* Fase 1 — Marca "PARTIU DF" (sólida, revelada por máscara) + logo à direita */}
      <div
        aria-hidden
        className="relative isolate flex w-full max-w-md -translate-y-16 items-center justify-center gap-3 text-df-blue sm:-translate-y-24 sm:gap-4"
      >
        <motion.svg
          viewBox="0 0 320 100"
          className="h-auto w-56 select-none sm:w-64"
          role="img"
          aria-label="PARTIU DF"
          // "Estiligada" de borracha: após revelar, dá um pop elástico (overshoot).
          animate={
            drawn ? { scale: [1, 1.18, 0.94, 1.05, 1] } : { scale: 1 }
          }
          transition={
            drawn
              ? { duration: 0.6, ease: 'easeInOut', times: [0, 0.3, 0.55, 0.8, 1] }
              : { duration: 0 }
          }
          style={{ transformOrigin: 'center' }}
        >
          <defs>
            {/* Máscara que cresce da esquerda → direita, revelando as letras. */}
            <mask id="partiu-reveal">
              <motion.rect
                x="0"
                y="0"
                width="320"
                height="100"
                fill="#fff"
                style={{ transformBox: 'fill-box', transformOrigin: 'left' }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: DRAW_DURATION, ease: 'easeInOut' }}
                onAnimationComplete={() => setDrawn(true)}
              />
            </mask>
          </defs>
          <text
            x="160"
            y="66"
            textAnchor="middle"
            fontSize="56"
            fontWeight={900}
            letterSpacing="1"
            textLength="300"
            lengthAdjust="spacingAndGlyphs"
            fill="currentColor"
            mask="url(#partiu-reveal)"
            // Fonte Roboto: utility `font-roboto` (var(--font-roboto)),
            // definida em tailwind.config.ts.
            className="font-roboto"
          >
            PARTIU DF
          </text>
        </motion.svg>

        {/* Logo PARTIU DF, à direita da frase (entra após a revelação). */}
        <motion.img
          src="/logo.png"
          alt=""
          draggable={false}
          initial={{ opacity: 0, scale: 0 }}
          animate={drawn ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
          // Entra com mola elástica (overshoot) — efeito de borracha.
          transition={{
            scale: { type: 'spring', stiffness: 500, damping: 11, mass: 0.6 },
            opacity: { duration: 0.2 },
          }}
          className="h-12 w-12 select-none object-contain sm:h-16 sm:w-16"
        />
      </div>

      {/* Fase 2 — Cena: céu + estrada + van (só "roda" depois da escrita) */}
      <div className="relative w-full max-w-md overflow-hidden">
        {/* Faixa do céu (efeito de horizonte) */}
        <div className="relative h-24 sm:h-28">
          {/* Van parada fora da tela até `drawn`; aí entra rodando em loop. */}
          <motion.img
            src="/van.png"
            alt=""
            aria-hidden
            draggable={false}
            initial={{ x: '110%' }}
            animate={drawn ? { x: ['110%', '-30%'] } : { x: '110%' }}
            transition={
              drawn
                ? { duration: 5.5, ease: 'linear', repeat: Infinity }
                : { duration: 0 }
            }
            className="absolute bottom-2 left-0 h-16 w-auto select-none drop-shadow-[0_8px_12px_rgba(0,168,232,0.25)] sm:h-20"
            style={{ willChange: 'transform', transform: 'scaleX(-1)' }}
          />
        </div>

        {/* Pista: linha sólida + pontilhado que "corre" para a direita
            (oposto ao van que vai para a esquerda). Só anima após a escrita. */}
        <div className="relative mt-1 h-1.5 w-full overflow-hidden rounded-full bg-df-border">
          <motion.div
            aria-hidden
            animate={drawn ? { backgroundPosition: ['0% 0%', '200% 0%'] } : undefined}
            transition={
              drawn ? { duration: 1.6, ease: 'linear', repeat: Infinity } : undefined
            }
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, var(--df-blue) 0 14px, transparent 14px 26px)',
              backgroundSize: '200% 100%',
              willChange: 'background-position',
            }}
          />
        </div>
      </div>

      {/* Mensagem + dots */}
      <div className="flex items-center gap-2 text-df-muted">
        <span className="text-sm">{message}</span>
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="block size-1.5 rounded-full bg-df-blue"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
