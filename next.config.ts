import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
    ],
  },
};

export default nextConfig;
