import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { listedProduct } from "@/lib/catalog";
import { absolute } from "@/lib/seo";

// Built per request: the build machine may not reach the database.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, stores] = await Promise.all([
    db.product.findMany({
      where: listedProduct,
      select: { slug: true, updatedAt: true },
      orderBy: { soldCount: "desc" },
      take: 45000,
    }),
    db.category.findMany({ select: { slug: true } }),
    db.sellerProfile.findMany({
      where: { kycStatus: "APPROVED", salesSuspendedAt: null },
      select: { slug: true },
    }),
  ]);
  return [
    { url: absolute("/"), changeFrequency: "daily", priority: 1 },
    ...categories.map((c) => ({
      url: absolute(`/categories/${encodeURIComponent(c.slug)}`),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: absolute(`/products/${encodeURIComponent(p.slug)}`),
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...stores.map((s) => ({
      url: absolute(`/stores/${encodeURIComponent(s.slug)}`),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    { url: absolute("/pages/terms"), priority: 0.2 },
    { url: absolute("/pages/refunds"), priority: 0.2 },
  ];
}
