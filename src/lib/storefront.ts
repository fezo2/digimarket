import "server-only";
import { cache } from "react";
import { db } from "./db";
import { listedProduct } from "./catalog";

// Top-level categories with their subcategories and how many listed products
// each holds (subcategories included). Shared by the header catalog, the home
// page and the category sidebar within one request.
export const storeCategories = cache(async () => {
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

// Thumbs up/down as a whole percentage, or null before the first review.
export function positivePercent(positive: number, negative: number) {
  const total = positive + negative;
  return total ? Math.round((positive * 100) / total) : null;
}
