import "server-only";
import { db } from "./db";
import { listedProduct } from "./catalog";
import { absolute, storeOrigin } from "./seo";

// IndexNow tells Bing (which ChatGPT search, Copilot and DuckDuckGo read)
// and Yandex about new or changed pages within minutes instead of weeks.
// Needs INDEXNOW_KEY (8–128 letters, digits or dashes); the key is public
// by design and is served at /indexnow.txt to prove we own the site.
export function indexNowKey() {
  const key = process.env.INDEXNOW_KEY?.trim();
  return key && /^[A-Za-z0-9-]{8,128}$/.test(key) ? key : null;
}

// Hourly job: send every listed product changed in the last 70 minutes.
export async function submitRecentChanges() {
  const key = indexNowKey();
  if (!key) return 0;
  const since = new Date(Date.now() - 70 * 60 * 1000);
  const products = await db.product.findMany({
    where: { ...listedProduct, updatedAt: { gte: since } },
    select: { slug: true },
    take: 10000,
  });
  if (!products.length) return 0;
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(storeOrigin()).host,
      key,
      keyLocation: absolute("/indexnow.txt"),
      urlList: products.map((p) => absolute(`/products/${encodeURIComponent(p.slug)}`)),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok && res.status !== 202) throw new Error(`IndexNow ${res.status}`);
  return products.length;
}
