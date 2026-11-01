import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@partiudf/shared'],
  devIndicators: false,
  // a tela do passageiro virou a raiz; links/QR antigos com /p continuam funcionando
  async redirects() {
    return [{ source: '/p', destination: '/', permanent: true }];
  },
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;
