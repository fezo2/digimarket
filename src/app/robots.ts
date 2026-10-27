import type { MetadataRoute } from "next";
import { currentSite } from "@/lib/auth";
import { absolute } from "@/lib/seo";

// Only the store is for search engines; the seller and admin hosts say no.
export default async function robots(): Promise<MetadataRoute.Robots> {
  if ((await currentSite()) !== "store")
    return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account",
        "/checkout",
        "/pay",
        "/api",
        "/seller",
        "/admin",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/search",
      ],
    },
    sitemap: absolute("/sitemap.xml"),
  };
}
