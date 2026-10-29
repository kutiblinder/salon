import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['sharp'],
  // Localni custom domeni (npm run hosts:dev). Bez ovoga Next blokira /_next JS.
  allowedDevOrigins: [
    'ateljekosic.rs',
    'zenmasaza.rs',
    'bellanails.rs',
    'atelje.localhost',
    'zen.localhost',
    'bella.localhost',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
};

export default nextConfig;
