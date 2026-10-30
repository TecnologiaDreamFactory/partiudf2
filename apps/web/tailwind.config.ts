import type { Config } from 'tailwindcss';

/** Token CSS com suporte a opacidade do Tailwind (`bg-df-blue/40`). */
const token = (name: string) =>
  `color-mix(in srgb, var(--df-${name}) calc(<alpha-value> * 100%), transparent)`;

export default {
  // app usado quase so no celular: hover so onde existe mouse, sem "hover grudado" apos o toque
  future: { hoverOnlyWhenSupported: true },
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/shared/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Tokens via CSS variables (globals.css), tema unico escuro.
        df: {
          blue: token('blue'),
          'blue-dark': token('blue-dark'),
          'blue-light': token('blue-light'),
          'blue-soft': 'var(--df-blue-soft)',
          ink: token('ink'),
          muted: token('muted'),
          surface: token('surface'),
          'surface-2': token('surface-2'),
          border: 'var(--df-border)',
          line: 'var(--df-line-2)',
          danger: token('danger'),
          success: token('success'),
          warning: token('warning'),
        },
        // ponytail: alias legado de /d, /admin e /profile — some quando essas telas forem refeitas.
        dream: {
          blue: token('blue'),
        },
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      backgroundImage: {
        'df-grad': 'var(--df-grad)',
      },
      transitionTimingFunction: {
        df: 'cubic-bezier(.22,1,.36,1)',
      },
      letterSpacing: {
        tag: '.14em',
      },
    },
  },
  plugins: [],
} satisfies Config;
