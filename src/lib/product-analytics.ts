import "server-only";
import { createHmac } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { authSecret } from "./session-token";
import { cairoDay, type Period } from "./seller-period";
import { isBotAgent, VISITOR_COOKIE, validVisitorId } from "./visitor";

// Product funnel: page views and add-to-cart come from ProductEvent (one row
// per visitor, product, kind and Cairo day); reaching checkout is an order
// being created, and paid is the order's paidAt. Everything is read with a
// few GROUP BY queries, so nothing runs in the background.

export type EventKind = "VIEW" | "CART";

// A stable, non-reversible id for the browser: its dm_vid cookie when it has
// one, otherwise IP + user agent. Salted so the stored value can't be tied
// back to an IP.
export function visitorKey(input: {
  cookie?: string | null;
  ip?: string | null;
  agent?: string | null;
}) {
  const raw = validVisitorId(input.cookie)
    ? `c:${input.cookie}`
    : `i:${input.ip ?? ""}|${input.agent ?? ""}`;
  return createHmac("sha256", authSecret())
    .update(raw)
    .digest("base64url")
    .slice(0, 22);
}

// Records one funnel step. Skips bots, unknown or unlisted products, and the
// product's own seller looking at it. Never throws: analytics must not break
// a page or a cart.
export async function recordProductEvent(input: {
  productId: string;
  kind: EventKind;
  visitor: string;
  userId?: string | null;
  agent?: string | null;
  now?: Date;
}) {
  if (isBotAgent(input.agent)) return false;
  const day = cairoDay(input.now ?? new Date());
  try {
    const n = await db.$executeRaw`
      INSERT INTO "ProductEvent" ("productId", kind, visitor, day)
      SELECT p.id, ${input.kind}::"ProductEventKind", ${input.visitor}, ${day}::date
      FROM "Product" p JOIN "SellerProfile" s ON s.id = p."sellerId"
      WHERE p.id = ${input.productId}
        AND p.status = 'ACTIVE'
        AND s."userId" IS DISTINCT FROM ${input.userId ?? null}
      ON CONFLICT ("productId", kind, visitor, day) DO NOTHING`;
    return n > 0;
  } catch (error) {
    console.error("product event", error);
    return false;
  }
}

export { VISITOR_COOKIE };

export type FunnelScope = {
  // Only this seller's products (seller office).
  sellerId?: string;
  // Only this product.
  productId?: string;
  // Title contains (case-insensitive).
  q?: string;
};

export const SORTS = ["views", "carts", "checkouts", "paid", "revenue", "conversion"] as const;
export type SortKey = (typeof SORTS)[number];

export type FunnelRow = {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  storeName: string;
  views: number;
  carts: number;
  checkouts: number;
  paid: number;
  revenue: number;
};

export type Funnel = { views: number; carts: number; checkouts: number; paid: number; revenue: number };

type Range = { from: Date | null; to: Date };

function scopeSql(scope: FunnelScope) {
  const parts = [Prisma.sql`TRUE`];
  if (scope.sellerId) parts.push(Prisma.sql`p."sellerId" = ${scope.sellerId}`);
  if (scope.productId) parts.push(Prisma.sql`p.id = ${scope.productId}`);
  if (scope.q) parts.push(Prisma.sql`p.title ILIKE ${"%" + scope.q.replace(/[\\%_]/g, "\\$&") + "%"}`);
  return Prisma.join(parts, " AND ");
}

// Per-product counts for [from, to), in SQL. The CTEs only touch rows in the
// range, so this stays cheap as history grows.
function funnelCte(range: Range) {
  const from = range.from ?? new Date(0);
  return Prisma.sql`
    WITH ev AS (
      SELECT "productId",
             COUNT(*) FILTER (WHERE kind = 'VIEW') AS views,
             COUNT(*) FILTER (WHERE kind = 'CART') AS carts
      FROM "ProductEvent"
      WHERE "createdAt" >= ${from} AND "createdAt" < ${range.to}
      GROUP BY 1
    ), co AS (
      SELECT oi."productId", COUNT(DISTINCT o.id) AS checkouts
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."createdAt" >= ${from} AND o."createdAt" < ${range.to}
      GROUP BY 1
    ), pd AS (
      SELECT oi."productId", COUNT(DISTINCT o.id) AS paid,
             SUM(oi.total - oi."refundedAmount") AS revenue
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."paidAt" >= ${from} AND o."paidAt" < ${range.to}
      GROUP BY 1
    ), f AS (
      SELECT p.id, p.title, p.slug, p."imageUrl", s."storeName",
             COALESCE(ev.views, 0)::int AS views,
             COALESCE(ev.carts, 0)::int AS carts,
             COALESCE(co.checkouts, 0)::int AS checkouts,
             COALESCE(pd.paid, 0)::int AS paid,
             COALESCE(pd.revenue, 0)::int AS revenue
      FROM "Product" p
      JOIN "SellerProfile" s ON s.id = p."sellerId"
      LEFT JOIN ev ON ev."productId" = p.id
      LEFT JOIN co ON co."productId" = p.id
      LEFT JOIN pd ON pd."productId" = p.id
      WHERE (ev."productId" IS NOT NULL OR co."productId" IS NOT NULL OR pd."productId" IS NOT NULL)
    )`;
}

const ORDER: Record<SortKey, Prisma.Sql> = {
  views: Prisma.sql`views DESC, paid DESC`,
  carts: Prisma.sql`carts DESC, views DESC`,
  checkouts: Prisma.sql`checkouts DESC, views DESC`,
  paid: Prisma.sql`paid DESC, views DESC`,
  revenue: Prisma.sql`revenue DESC, paid DESC`,
  // Paid per view; products with a handful of views would top this by luck,
  // so they sort after those with at least 10.
  conversion: Prisma.sql`(views >= 10) DESC, paid::float / GREATEST(views, 1) DESC, paid DESC`,
};

export async function productFunnel(
  range: Range,
  scope: FunnelScope,
  opts: { sort: SortKey; take: number; skip: number },
) {
  const where = scopeSql(scope);
  const [rows, totals] = await Promise.all([
    db.$queryRaw<FunnelRow[]>`
      ${funnelCte(range)}
      SELECT f.* FROM f JOIN "Product" p ON p.id = f.id
      WHERE ${where}
      ORDER BY ${ORDER[opts.sort]}, f.id
      LIMIT ${opts.take} OFFSET ${opts.skip}`,
    db.$queryRaw<(Funnel & { products: number })[]>`
      ${funnelCte(range)}
      SELECT COUNT(*)::int AS products,
             COALESCE(SUM(views), 0)::int AS views, COALESCE(SUM(carts), 0)::int AS carts,
             COALESCE(SUM(checkouts), 0)::int AS checkouts, COALESCE(SUM(paid), 0)::int AS paid,
             COALESCE(SUM(revenue), 0)::bigint AS revenue
      FROM f JOIN "Product" p ON p.id = f.id
      WHERE ${where}`,
  ]);
  const t = totals[0];
  return {
    rows,
    products: t?.products ?? 0,
    totals: {
      views: t?.views ?? 0,
      carts: t?.carts ?? 0,
      checkouts: t?.checkouts ?? 0,
      paid: t?.paid ?? 0,
      revenue: Number(t?.revenue ?? 0),
    } satisfies Funnel,
  };
}

export type TrendRow = {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  storeName: string;
  views: number;
  before: number;
  carts: number;
  paid: number;
};

// "Viral": most viewed in the range, with the views of the equal window right
// before it so a sudden jump stands out.
export async function trendingProducts(
  range: { from: Date; to: Date; prevFrom: Date },
  scope: FunnelScope,
  take = 8,
) {
  const where = scopeSql(scope);
  return db.$queryRaw<TrendRow[]>`
    WITH cur AS (
      SELECT "productId",
             COUNT(*) FILTER (WHERE kind = 'VIEW') AS views,
             COUNT(*) FILTER (WHERE kind = 'CART') AS carts
      FROM "ProductEvent"
      WHERE "createdAt" >= ${range.from} AND "createdAt" < ${range.to}
      GROUP BY 1
    ), prev AS (
      SELECT "productId", COUNT(*) AS views
      FROM "ProductEvent"
      WHERE kind = 'VIEW' AND "createdAt" >= ${range.prevFrom} AND "createdAt" < ${range.from}
      GROUP BY 1
    ), pd AS (
      SELECT oi."productId", COUNT(DISTINCT o.id) AS paid
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."paidAt" >= ${range.from} AND o."paidAt" < ${range.to}
      GROUP BY 1
    )
    SELECT p.id, p.title, p.slug, p."imageUrl", s."storeName",
           cur.views::int AS views, COALESCE(prev.views, 0)::int AS before,
           cur.carts::int AS carts, COALESCE(pd.paid, 0)::int AS paid
    FROM cur
    JOIN "Product" p ON p.id = cur."productId"
    JOIN "SellerProfile" s ON s.id = p."sellerId"
    LEFT JOIN prev ON prev."productId" = p.id
    LEFT JOIN pd ON pd."productId" = p.id
    WHERE cur.views > 0 AND ${where}
    ORDER BY cur.views DESC, (cur.views - COALESCE(prev.views, 0)) DESC, p.id
    LIMIT ${take}`;
}

// Views and paid orders per hour or day, keyed like periodSlots().
export async function funnelSeries(
  range: { from: Date; to: Date },
  bucket: Period["bucket"],
  scope: FunnelScope,
) {
  const where = scopeSql(scope);
  // Bucket on Cairo wall time, keyed exactly like periodSlots().
  const fmt = bucket === "hour" ? "YYYY-MM-DD HH24" : bucket === "month" ? "YYYY-MM" : "YYYY-MM-DD";
  const cairo = (col: Prisma.Sql) =>
    Prisma.sql`to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Cairo', ${fmt})`;
  const [views, paid] = await Promise.all([
    db.$queryRaw<{ k: string; n: number }[]>`
      SELECT ${cairo(Prisma.sql`e."createdAt"`)} AS k, COUNT(*)::int AS n
      FROM "ProductEvent" e JOIN "Product" p ON p.id = e."productId"
      WHERE e.kind = 'VIEW' AND e."createdAt" >= ${range.from} AND e."createdAt" < ${range.to}
        AND ${where}
      GROUP BY 1`,
    db.$queryRaw<{ k: string; n: number }[]>`
      SELECT ${cairo(Prisma.sql`o."paidAt"`)} AS k, COUNT(DISTINCT o.id)::int AS n
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId" JOIN "Product" p ON p.id = oi."productId"
      WHERE o."paidAt" >= ${range.from} AND o."paidAt" < ${range.to} AND ${where}
      GROUP BY 1`,
  ]);
  const fold = (rows: { k: string; n: number }[]) => new Map(rows.map((r) => [r.k, r.n]));
  return { views: fold(views), paid: fold(paid) };
}
