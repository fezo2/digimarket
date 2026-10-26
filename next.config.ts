import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Product uploads: 50 MB plus multipart overhead; per-folder limits remain in storage.
    serverActions: { bodySizeLimit: "55mb" },
  },
};

export default nextConfig;
