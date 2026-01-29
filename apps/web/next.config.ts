import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Disable Turbopack for build due to issues with non-ASCII paths
  // This is a known issue: https://github.com/vercel/next.js/issues/
  experimental: {
    // Use webpack for production builds
  },
};

export default nextConfig;
