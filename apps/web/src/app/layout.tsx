import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter, Outfit, Roboto } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-outfit',
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  display: 'swap',
  variable: '--font-roboto',
});

export const metadata: Metadata = {
  title: 'PARTIU DF',
  description: 'Acompanhamento em tempo real da van PARTIU DF',
  manifest: '/manifest.json',
  applicationName: 'PARTIU DF',
  appleWebApp: {
    capable: true,
    title: 'PARTIU DF',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#00A8E8' },
    { media: '(prefers-color-scheme: dark)', color: '#0F172A' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${outfit.variable} ${roboto.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider>
          {children}
          <Toaster
            position="top-center"
            richColors
            closeButton
            theme="system"
            toastOptions={{
              style: {
                borderRadius: '12px',
                fontFamily: 'var(--font-inter)',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
