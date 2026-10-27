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
      // Private pages carry noindex themselves; list only what crawlers
      // would otherwise waste time on.
      disallow: ["/account", "/checkout", "/pay", "/api", "/search"],
    },
    sitemap: absolute("/sitemap.xml"),
  };
}
