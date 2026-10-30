import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/shared/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Tokens via CSS variables → trocam automaticamente em dark.
        df: {
          blue: 'var(--df-blue)',
          'blue-dark': 'var(--df-blue-dark)',
          'blue-soft': 'var(--df-blue-soft)',
          ink: 'var(--df-ink)',
          muted: 'var(--df-muted)',
          surface: 'var(--df-surface)',
          'surface-2': 'var(--df-surface-2)',
          border: 'var(--df-border)',
          danger: 'var(--df-danger)',
          success: 'var(--df-success)',
          warning: 'var(--df-warning)',
        },
        // Alias legado: `dream-blue` continua funcionando nas páginas antigas.
        dream: {
          blue: 'var(--df-blue)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-outfit)', 'var(--font-inter)', 'sans-serif'],
        roboto: ['var(--font-roboto)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        soft: '0 2px 12px rgba(10, 25, 41, 0.06), 0 1px 3px rgba(10, 25, 41, 0.04)',
        elevated:
          '0 10px 30px rgba(10, 25, 41, 0.08), 0 4px 10px rgba(10, 25, 41, 0.04)',
        'df-glow': '0 0 0 4px rgba(0, 168, 232, 0.18)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
