import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@partiudf/shared'],
  devIndicators: false,
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;
