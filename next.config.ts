import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Production builds never ship source maps to the browser.
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: Object.entries(securityHeaders()).map(([key, value]) => ({
          key,
          value,
        })),
      },
    ];
  },
  experimental: {
    // Product uploads: 50 MB plus multipart overhead; per-folder limits remain in storage.
    serverActions: {
      bodySizeLimit: process.env.STORAGE_DRIVER === "r2" ? "4mb" : "55mb",
    },
  },
};

export default nextConfig;
