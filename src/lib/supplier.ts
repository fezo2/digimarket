import "server-only";
import { z } from "zod";
import { db } from "./db";
import { deliverPaidOrder, lockOrder } from "./orders";
import { alertAdmin } from "./notifications";
import { saveProductImageBytes } from "./product-image";
import { slugify, uniqueSuffix } from "./slug";
import { guessCategorySlug, supplierPrice } from "./supplier-pricing";
import * as prodseller from "./suppliers/prodseller";
import { SupplierError } from "./suppliers/prodseller";

// Resale of ProdSeller products: the admin imports them onto one store, a job
// keeps their cost, stock and price in sync, and every paid order is bought
// from ProdSeller and its keys delivered as ordinary stock codes.

export const SUPPLIER = "prodseller";
export class SupplierImportError extends Error {}

export async function supplierSettings() {
  return (
    (await db.supplierSettings.findUnique({ where: { id: SUPPLIER } })) ?? {
      id: SUPPLIER,
      sellerId: null,
      usdRate: 5500,
      multiplierBps: 25000,
      updatedAt: new Date(0),
    }
  );
}

const settingsInput = z.object({
  sellerId: z.string().min(1, "اختار المتجر"),
  usdRate: z.coerce.number().min(1, "سعر الدولار مش صحيح").max(1000),
  multiplier: z.coerce.number().min(1, "مضاعف السعر لازم يكون 1 أو أكتر").max(20),
});

export async function saveSupplierSettings(
  actorId: string,
  input: z.input<typeof settingsInput>,
) {
  const v = settingsInput.parse(input);
  const data = {
    sellerId: v.sellerId,
    usdRate: Math.round(v.usdRate * 100),
    multiplierBps: Math.round(v.multiplier * 10000),
  };
  await db.$transaction(async (tx) => {
    if (!(await tx.sellerProfile.findUnique({ where: { id: v.sellerId } })))
      throw new SupplierImportError("المتجر مش موجود");
    await tx.supplierSettings.upsert({
      where: { id: SUPPLIER },
      create: { id: SUPPLIER, ...data },
      update: data,
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "supplier.settings",
        targetId: SUPPLIER,
        data: JSON.stringify(data),
      },
    });
  });
  await syncSupplierProducts();
  return true;
}

async function downloadImage(sellerId: string, url: string | null) {
  if (!url || !/^https:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const bytes = new Uint8Array(await res.arrayBuffer());
    return await saveProductImageBytes(sellerId, bytes, type);
  } catch {
    return null;
  }
}

const importInput = z.array(
  z.object({ id: z.string().min(1).max(100), categoryId: z.string().min(1) }),
);

// Creates the picked supplier products on the configured store. They go live
// straight away (an admin picked them), and only list once the store's KYC is
// approved. Products that need the buyer's email are left out: the supplier
// activates those by hand, so they can't be delivered instantly.
export async function importSupplierProducts(
  actorId: string,
  picks: z.input<typeof importInput>,
) {
  const items = importInput.parse(picks);
  if (!items.length) throw new SupplierImportError("اختار منتج واحد على الأقل");
  const settings = await supplierSettings();
  if (!settings.sellerId)
    throw new SupplierImportError("احفظ إعدادات المتجر وسعر الدولار الأول");
  const seller = await db.sellerProfile.findUniqueOrThrow({
    where: { id: settings.sellerId },
  });
  const catalog = new Map(
    (await prodseller.listProducts()).map((p) => [p.id, p]),
  );
  const categories = new Map<string, { id: string }>(
    (await db.category.findMany()).map((c) => [c.id, c]),
  );
  let created = 0;
  for (const pick of items) {
    const p = catalog.get(pick.id);
    const category = categories.get(pick.categoryId);
    if (!p || !category || p.needsEmail || !p.priceMills) continue;
    if (
      await db.product.findUnique({
        where: {
          supplier_supplierProductId: {
            supplier: SUPPLIER,
            supplierProductId: p.id,
          },
        },
      })
    )
      continue;
    const imageUrl = await downloadImage(seller.id, p.imageUrl);
    const title = p.name.slice(0, 160) || "منتج";
    const product = await db.product.create({
      data: {
        sellerId: seller.id,
        categoryId: category.id,
        slug: `${slugify(title)}-${uniqueSuffix()}`,
        title,
        description:
          p.description.length >= 10 ? p.description.slice(0, 20000) : title,
        imageUrl,
        price: supplierPrice({
          costMills: p.priceMills,
          usdRate: settings.usdRate,
          multiplierBps: settings.multiplierBps,
        }),
        deliveryType: "UNIQUE_CODES",
        instructions: "الكود أو بيانات الحساب بتظهر هنا على طول بعد الدفع.",
        status: "ACTIVE",
        minQty: 1,
        maxQty: 10,
        supplier: SUPPLIER,
        supplierProductId: p.id,
        supplierCostMills: p.priceMills,
        supplierStock: p.stock,
        supplierSyncedAt: new Date(),
      },
    });
    await db.auditLog.create({
      data: {
        actorId,
        action: "supplier.imported",
        targetId: product.id,
        data: JSON.stringify({ supplierProductId: p.id }),
      },
    });
    created++;
  }
  // Fill in exact stock counts for the new products.
  if (created) await syncSupplierProducts().catch(() => 0);
  return created;
}

// Moves every imported product to the category its name points to.
export async function recategorizeSupplierProducts(actorId: string) {
  const bySlug = new Map(
    (await db.category.findMany({ select: { id: true, slug: true } })).map(
      (c) => [c.slug, c.id],
    ),
  );
  const products = await db.product.findMany({
    where: { supplier: SUPPLIER },
    select: { id: true, title: true, categoryId: true },
  });
  let moved = 0;
  for (const p of products) {
    const target = bySlug.get(guessCategorySlug(p.title));
    if (!target || target === p.categoryId) continue;
    await db.product.update({ where: { id: p.id }, data: { categoryId: target } });
    moved++;
  }
  await db.auditLog.create({
    data: {
      actorId,
      action: "supplier.recategorized",
      targetId: SUPPLIER,
      data: JSON.stringify({ moved }),
    },
  });
  return moved;
}

// Pulls cost and stock for every imported product and re-prices it from the
// current settings. A product the supplier dropped shows as out of stock.
export async function syncSupplierProducts() {
  if (!prodseller.prodsellerConfigured()) return 0;
  const products = await db.product.findMany({
    where: { supplier: SUPPLIER },
  });
  if (!products.length) return 0;
  const settings = await supplierSettings();
  const catalog = new Map(
    (await prodseller.listProducts()).map((p) => [p.id, p]),
  );
  let changed = 0;
  let details = 0;
  for (const product of products) {
    const p = catalog.get(product.supplierProductId ?? "");
    let stock = p ? p.stock : 0;
    // The list only says in stock or not; ask for the exact count, within
    // the supplier's rate limit (300 requests per 15 minutes).
    if (p && stock === null && details < 60) {
      details++;
      stock = await prodseller
        .getProduct(p.id)
        .then((d) => d.stock)
        .catch(() => null);
    }
    const cost = p?.priceMills || product.supplierCostMills || 0;
    const price = cost
      ? supplierPrice({
          costMills: cost,
          usdRate: settings.usdRate,
          multiplierBps: settings.multiplierBps,
        })
      : product.price;
    await db.product.update({
      where: { id: product.id },
      data: {
        supplierCostMills: cost || null,
        supplierStock: stock,
        supplierSyncedAt: new Date(),
        price,
        ...(product.compareAtPrice !== null && product.compareAtPrice <= price
          ? { compareAtPrice: null }
          : {}),
      },
    });
    if (price !== product.price || stock !== product.supplierStock) changed++;
  }
  return changed;
}

// Best-effort fresh stock right before checkout, so a buyer isn't sent to pay
// for something the supplier just sold out of.
export async function refreshSupplierStock(productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { supplier: true, supplierProductId: true },
  });
  if (product?.supplier !== SUPPLIER || !product.supplierProductId) return;
  try {
    const p = await prodseller.getProduct(product.supplierProductId);
    await db.product.update({
      where: { id: productId },
      data: { supplierStock: p.stock, supplierSyncedAt: new Date() },
    });
  } catch {
    // Keep the last synced number.
  }
}

async function failItem(itemId: string, orderId: string, reason: string) {
  await db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    await tx.orderItem.update({
      where: { id: itemId },
      data: { supplierError: reason, supplierAttempt: { increment: 1 } },
    });
    await tx.order.updateMany({
      where: { id: orderId, status: "PAID" },
      data: { reviewReason: reason },
    });
  });
}

// Buys a paid order from the supplier and delivers the keys. Safe to call
// again at any time: the idempotency key and the stored supplier order id
// stop a second purchase. A refused purchase (no balance, out of stock) is not
// retried by the job; an admin retries it from the order page.
export async function fulfilSupplierOrder(
  orderId: string,
  opts: { retryFailed?: boolean } = {},
): Promise<{ delivered?: boolean; pending?: boolean; error?: string }> {
  const item = await db.orderItem.findFirst({
    where: { orderId, supplier: SUPPLIER, order: { status: "PAID" } },
    include: {
      product: { select: { supplierProductId: true } },
      order: { select: { number: true } },
    },
  });
  if (!item || item.deliveredAt) return {};
  if (item.supplierError && !opts.retryFailed) return { error: item.supplierError };
  if (item.supplierError)
    await db.orderItem.update({
      where: { id: item.id },
      data: { supplierError: null },
    });
  const reserved = await db.stockItem.count({
    where: { orderItemId: item.id, status: "RESERVED" },
  });
  let keys: string[] = [];
  if (reserved < item.quantity) {
    if (!item.product.supplierProductId)
      return { error: "المنتج مش مربوط بمنتج عند المورد" };
    let bought;
    try {
      bought = item.supplierOrderId
        ? await prodseller.getOrder(item.supplierOrderId)
        : await prodseller.buy(
            item.product.supplierProductId,
            item.quantity,
            `digiegy-${item.id}-${item.supplierAttempt}`,
          );
    } catch (error) {
      if (error instanceof SupplierError && error.final) {
        await failItem(item.id, orderId, error.message);
        await alertAdmin(
          `⚠️ طلب #${item.order.number} اتدفع ومتسلمش من ProdSeller:\n${error.message}\nاشحن الرصيد أو راجع المنتج، وبعدين "إعادة التسليم" من صفحة الطلب في لوحة الأدمن.`,
        );
        return { error: error.message };
      }
      return { pending: true };
    }
    if (bought.orderId && bought.orderId !== item.supplierOrderId)
      await db.orderItem.update({
        where: { id: item.id },
        data: { supplierOrderId: bought.orderId },
      });
    if (bought.status === "failed") {
      const reason = "ProdSeller: الطلب فشل عند المورد";
      await failItem(item.id, orderId, reason);
      await alertAdmin(`⚠️ طلب #${item.order.number}: ${reason}`);
      return { error: reason };
    }
    if (bought.keys.length < item.quantity) return { pending: true };
    keys = bought.keys.slice(0, item.quantity);
  }
  const result = await db.$transaction(
    async (tx) => {
      await lockOrder(tx, orderId);
      const now = await tx.stockItem.count({
        where: { orderItemId: item.id, status: { in: ["RESERVED", "SOLD"] } },
      });
      if (now === 0 && keys.length)
        await tx.stockItem.createMany({
          data: keys.map((content) => ({
            productId: item.productId,
            content,
            status: "RESERVED" as const,
            orderItemId: item.id,
          })),
        });
      const r = await deliverPaidOrder(tx, orderId);
      if (r.error)
        await tx.order.updateMany({
          where: { id: orderId, status: "PAID" },
          data: { reviewReason: r.error },
        });
      return r;
    },
    { timeout: 15000 },
  );
  return result.error ? { error: result.error } : { delivered: Boolean(result.delivered) };
}

// Job: retry purchases that hit a network error or are still being prepared
// by the supplier, then refresh the catalogue.
export async function runSupplierJob() {
  if (!prodseller.prodsellerConfigured()) return 0;
  const waiting = await db.orderItem.findMany({
    where: {
      supplier: SUPPLIER,
      deliveredAt: null,
      supplierError: null,
      order: { status: "PAID" },
    },
    select: { orderId: true },
    take: 20,
  });
  let done = 0;
  for (const w of waiting)
    if (
      (
        await fulfilSupplierOrder(w.orderId).catch(
          (): { delivered?: boolean } => ({}),
        )
      ).delivered
    )
      done++;
  await syncSupplierProducts().catch((e) =>
    console.error("Supplier sync failed", e),
  );
  return done;
}
