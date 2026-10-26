import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // KYC uploads: up to 5 documents of 8 MB each.
    serverActions: { bodySizeLimit: "45mb" },
  },
};

export default nextConfig;
