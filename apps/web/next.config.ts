import type { NextConfig } from 'next';

// Tempo real (Supabase): o navegador abre https + wss para o projeto.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const isDev = process.env.NODE_ENV !== 'production';

// ponytail: script-src com 'unsafe-inline' porque o Next injeta scripts inline na hidratação;
// CSP com nonce exige middleware e render dinâmico. O que segura XSS aqui é escapar o texto
// (escapeHtml no mapa); a CSP limita para onde um script injetado consegue mandar dados.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} ${supabase.replace(/^http/, 'ws')}`,
  "media-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  transpilePackages: ['@partiudf/shared'],
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // a tela do passageiro virou a raiz; links/QR antigos com /p continuam funcionando
  async redirects() {
    return [{ source: '/p', destination: '/', permanent: true }];
  },
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;
