import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['sharp'],
  // Localni custom domeni (npm run hosts:dev). Bez ovoga Next blokira /_next JS.
  allowedDevOrigins: ['localhost.rs', 'sajt2.rs', 'sajt3.rs'],
  experimental: {
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
};

export default nextConfig;
