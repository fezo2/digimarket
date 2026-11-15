import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "./db";
import { listedProduct } from "./catalog";

// Top-level categories with their subcategories and how many listed products
// each holds (subcategories included). Shared by the header catalog, the home
// page and the category sidebar within one request.
//
// Public catalog reads go through Next's data cache (CATALOG_TTL seconds) so
// that crawlers and anonymous visits don't wake the database each time: on
// Neon's free plan every wake-up costs at least five minutes of compute.
export const CATALOG_TAG = "catalog";
export const CATALOG_TTL = 600;
export function catalogCache<A extends unknown[], R>(
  key: string,
  fn: (...args: A) => Promise<R>,
) {
  return unstable_cache(fn, ["catalog", key], {
    tags: [CATALOG_TAG],
    revalidate: CATALOG_TTL,
  });
}
const loadStoreCategories = catalogCache("store-categories", async () => {
  const [categories, counts] = await Promise.all([
    db.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      include: { children: { orderBy: { sortOrder: "asc" } } },
    }),
    db.product.groupBy({ by: ["categoryId"], where: listedProduct, _count: true }),
  ]);
  const byCategory = new Map(counts.map((c) => [c.categoryId, c._count]));
  return categories.map((c) => ({
    ...c,
    count: [c, ...c.children].reduce((n, x) => n + (byCategory.get(x.id) ?? 0), 0),
  }));
});
export const storeCategories = cache(() => loadStoreCategories());

// Thumbs up/down as a whole percentage, or null before the first review.
export function positivePercent(positive: number, negative: number) {
  const total = positive + negative;
  return total ? Math.round((positive * 100) / total) : null;
}
