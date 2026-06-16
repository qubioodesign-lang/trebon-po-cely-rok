import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PWA a optimalizace médií
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },
  // Povolení nahrávání souborů v API routes
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
