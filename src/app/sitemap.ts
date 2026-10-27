import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { listedProduct } from "@/lib/catalog";
import { absolute } from "@/lib/seo";

// Built per request: the build machine may not reach the database.
export const dynamic = "force-dynamic";

const INFO_PAGES = ["about", "faq", "contact", "terms", "refunds", "privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, stores] = await Promise.all([
    db.product.findMany({
      where: listedProduct,
      select: { slug: true, updatedAt: true },
      orderBy: { soldCount: "desc" },
      take: 45000,
    }),
    db.category.findMany({ select: { id: true, slug: true, parentId: true } }),
    db.sellerProfile.findMany({
      where: { kycStatus: "APPROVED", salesSuspendedAt: null },
      select: { slug: true },
    }),
  ]);
  // Only categories with listed products (counting their subcategories):
  // empty ones are noindex until something is for sale in them.
  const counts = await db.product.groupBy({ by: ["categoryId"], where: listedProduct, _count: true });
  const has = new Set(counts.filter((c) => c._count > 0).map((c) => c.categoryId));
  const filled = categories.filter(
    (c) => has.has(c.id) || categories.some((child) => child.parentId === c.id && has.has(child.id)),
  );
  return [
    { url: absolute("/"), changeFrequency: "daily", priority: 1 },
    ...filled.map((c) => ({
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
    ...INFO_PAGES.map((page) => ({ url: absolute(`/pages/${page}`), priority: 0.3 })),
  ];
}
