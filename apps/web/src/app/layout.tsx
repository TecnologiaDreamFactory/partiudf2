import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';
import { Toaster } from 'sonner';
import { MotionProvider } from '@/components/MotionProvider';
import './globals.css';

// Fonte unica do guide: Outfit variavel (200–900).
const outfit = Outfit({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'PARTIU DF',
  description: 'Acompanhamento em tempo real da van PARTIU DF',
  manifest: '/manifest.json',
  applicationName: 'PARTIU DF',
  appleWebApp: {
    capable: true,
    title: 'PARTIU DF',
    statusBarStyle: 'black',
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export const viewport: Viewport = {
  // tema unico (escuro): barra do navegador na cor do fundo do app
  themeColor: '#14161d',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={outfit.variable}>
      {/* suppressHydrationWarning: extensoes (ex.: ColorZilla) injetam atributos no body.
          Vale so para os atributos do proprio body, nao para os filhos. */}
      <body className="font-sans antialiased" suppressHydrationWarning>
        <MotionProvider>{children}</MotionProvider>
        <Toaster
          position="top-center"
          richColors
          closeButton
          theme="dark"
          toastOptions={{ style: { borderRadius: '18px', fontFamily: 'var(--font-outfit)' } }}
        />
      </body>
    </html>
  );
}
