import "server-only";
import { isListed } from "./catalog";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { enqueueNotice } from "./notifications";
import { db } from "./db";
import { quote } from "./pricing";
import { formatEGP } from "./money";
import { readOrderSnapshot } from "./order-snapshot";
import { SELLER_TIERS } from "./config";

export class OrderError extends Error {}
type Tx = Prisma.TransactionClient;
const orderInput = z.object({
  buyerId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(10000),
  selections: z.record(z.string(), z.string().max(200)),
  textInputs: z.record(z.string(), z.string().trim().max(2000)),
  buyerIp: z.string().max(64).optional(),
  buyerCountry: z.string().max(8).optional(),
});

export async function lockOrder(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
}

export async function releaseOrderStock(tx: Tx, orderId: string) {
  await tx.stockItem.updateMany({
    where: { status: "RESERVED", orderItem: { orderId } },
    data: { status: "AVAILABLE", orderItemId: null },
  });
}

async function reserveStock(
  tx: Tx,
  itemId: string,
  productId: string,
  quantity: number,
) {
  if (quantity === 0) return 0;
  return tx.$executeRaw`UPDATE "StockItem" SET status = 'RESERVED', "orderItemId" = ${itemId}
    WHERE id IN (SELECT id FROM "StockItem" WHERE "productId" = ${productId} AND status = 'AVAILABLE'
      ORDER BY "createdAt", id LIMIT ${quantity} FOR UPDATE SKIP LOCKED)`;
}

export async function releaseExpiredOrders() {
  return db.$transaction(async (tx) => {
    const now = new Date();
    const expired = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Order"
      WHERE status = 'PENDING_PAYMENT' AND "expiresAt" < (${now}::timestamptz AT TIME ZONE 'UTC')
        AND NOT EXISTS (SELECT 1 FROM "ManualPayment" m WHERE m."orderId" = "Order".id AND m.status IN ('SUBMITTED', 'CONFIRMED'))
      ORDER BY "createdAt" LIMIT 100 FOR UPDATE SKIP LOCKED`;
    if (!expired.length) return 0;
    const ids = expired.map((o) => o.id);
    await tx.stockItem.updateMany({
      where: { status: "RESERVED", orderItem: { orderId: { in: ids } } },
      data: { status: "AVAILABLE", orderItemId: null },
    });
    return (
      await tx.order.updateMany({
        where: { id: { in: ids }, status: "PENDING_PAYMENT" },
        data: { status: "CANCELLED" },
      })
    ).count;
  });
}

export async function createOrder(input: z.input<typeof orderInput>) {
  const parsed = orderInput.safeParse(input);
  if (!parsed.success) throw new OrderError("راجع الكمية واختيارات المنتج");
  const v = parsed.data;
  await releaseExpiredOrders();
  return db.$transaction(async (tx) => {
    // Keep the reviewed product/options stable until its purchase snapshot is saved.
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${v.productId} FOR SHARE`;
    const p = await tx.product.findUnique({
      where: { id: v.productId },
      include: {
        seller: true,
        category: true,
        options: { orderBy: { sortOrder: "asc" }, include: { values: true } },
        quantityDiscounts: true,
      },
    });
    if (!p || !isListed(p))
      throw new OrderError("المنتج مش متاح للشراء دلوقتي");
    if (p.seller.userId === v.buyerId)
      throw new OrderError("مينفعش تشتري منتج من متجرك");
    if (v.quantity < p.minQty || v.quantity > p.maxQty)
      throw new OrderError("الكمية خارج الحدود المسموحة");
    if (
      Object.keys(v.selections).some(
        (id) => !p.options.some((o) => o.id === id && o.kind === "select"),
      ) ||
      Object.keys(v.textInputs).some(
        (id) => !p.options.some((o) => o.id === id && o.kind === "text"),
      )
    )
      throw new OrderError("اختيارات المنتج مش صحيحة");
    const deltas: number[] = [];
    const choices: { name: string; value: string }[] = [];
    for (const o of p.options) {
      if (o.kind === "select") {
        const id = v.selections[o.id];
        if (!id) {
          if (o.required) throw new OrderError(`اختار ${o.name}`);
          continue;
        }
        const value = o.values.find((value) => value.id === id);
        if (!value) throw new OrderError("القيمة المختارة مش تابعة للاختيار");
        deltas.push(value.priceDelta);
        choices.push({ name: o.name, value: value.label });
      } else {
        const value = v.textInputs[o.id];
        if (!value && o.required) throw new OrderError(`اكتب ${o.name}`);
        if (value) choices.push({ name: o.name, value });
      }
    }
    // Serialize all checkout attempts by this buyer before checking either limit.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${v.buyerId} FOR UPDATE`;
    const pending = {
      buyerId: v.buyerId,
      status: "PENDING_PAYMENT" as const,
      expiresAt: { gt: new Date() },
    };
    if (
      await tx.order.count({
        where: { ...pending, items: { some: { productId: p.id } } },
      })
    )
      throw new OrderError(
        "عندك طلب مستني الدفع للمنتج ده، كمّل دفعه أو استنى انتهاء مدته",
      );
    if ((await tx.order.count({ where: pending })) >= 3)
      throw new OrderError(
        "مسموح بـ ٣ طلبات مستنية الدفع بس، كمّل دفع طلب أو استنى انتهاء مدته",
      );
    const pricing = {
      basePrice: p.price,
      optionDeltas: deltas,
      quantityDiscounts: p.quantityDiscounts.map((d) => ({
        minQty: d.minQty,
        percentOff: d.percentOff,
      })),
    };
    const q = quote({
      ...pricing,
      quantity: v.quantity,
      commissionBps: p.seller.commissionBps ?? p.category.commissionBps,
    });
    const order = await tx.order.create({
      data: {
        buyerId: v.buyerId,
        buyerIp: v.buyerIp,
        buyerCountry: v.buyerCountry,
        subtotal: q.subtotal,
        discount: q.subtotal - q.total,
        total: q.total,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        items: {
          create: {
            productId: p.id,
            sellerId: p.sellerId,
            title: p.title,
            quantity: v.quantity,
            unitPrice: q.unitPrice,
            total: q.total,
            commissionBps: p.seller.commissionBps ?? p.category.commissionBps,
            commissionAmount: q.commission,
            sellerNet: q.sellerNet,
            optionsJson: JSON.stringify({ choices, pricing }),
            deliveryType: p.deliveryType,
            deliveryContent:
              p.deliveryType === "UNIQUE_CODES" ? null : p.deliveryContent,
            instructions: p.instructions,
          },
        },
      },
      include: { items: { select: { id: true } } },
    });
    if (
      p.deliveryType === "UNIQUE_CODES" &&
      (await reserveStock(tx, order.items[0].id, p.id, v.quantity)) !==
        v.quantity
    )
      throw new OrderError("الكمية المتاحة مش كفاية");
    return { id: order.id };
  });
}

export async function applyCoupon(
  orderId: string,
  buyerId: string,
  code: string,
) {
  if (code.length > 100) throw new OrderError("كود الخصم مش صحيح");
  await releaseExpiredOrders();
  return db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findFirst({
      where: { id: orderId, buyerId },
      include: { items: true },
    });
    if (
      !order ||
      order.status !== "PENDING_PAYMENT" ||
      order.expiresAt <= new Date()
    )
      throw new OrderError("الطلب مش متاح للدفع");
    if (order.paymentProvider)
      throw new OrderError("مينفعش تغيّر الكوبون بعد بدء الدفع");
    const item = order.items[0];
    let coupon = null;
    if (code.trim()) {
      // Seller promo codes are stored upper-case; buyers may type them in any case.
      const typed = code.trim();
      const key = (await tx.coupon.count({ where: { code: typed } })) ? typed : typed.toUpperCase();
      await tx.$queryRaw`SELECT id FROM "Coupon" WHERE code = ${key} FOR UPDATE`;
      coupon = await tx.coupon.findUnique({ where: { code: key } });
      if (
        !coupon ||
        !coupon.active ||
        (coupon.expiresAt && coupon.expiresAt <= new Date()) ||
        (coupon.sellerId && coupon.sellerId !== item.sellerId)
      )
        throw new OrderError("الكوبون مش متاح للطلب ده أو انتهت صلاحيته");
      const pendingUses = await tx.order.count({
        where: {
          couponId: coupon.id,
          id: { not: order.id },
          status: "PENDING_PAYMENT",
          expiresAt: { gt: new Date() },
        },
      });
      if (
        coupon.usageLimit !== null &&
        coupon.usedCount + pendingUses >= coupon.usageLimit
      )
        throw new OrderError("الكوبون وصل للحد الأقصى للاستخدام");
    }
    const snapshot = readOrderSnapshot(item.optionsJson);
    const beforeCoupon = quote({
      ...snapshot.pricing,
      quantity: item.quantity,
      commissionBps: item.commissionBps,
    });
    if (
      coupon &&
      beforeCoupon.subtotal - beforeCoupon.quantityDiscount < coupon.minTotal
    )
      throw new OrderError(
        `الحد الأدنى لاستخدام الكوبون هو ${formatEGP(coupon.minTotal)} بعد خصم الكمية`,
      );
    const q = quote({
      ...snapshot.pricing,
      quantity: item.quantity,
      coupon,
      commissionBps: item.commissionBps,
    });
    await tx.orderItem.update({
      where: { id: item.id },
      data: {
        unitPrice: q.unitPrice,
        total: q.total,
        commissionAmount: q.commission,
        sellerNet: q.sellerNet,
      },
    });
    await tx.order.update({
      where: { id: order.id },
      data: {
        couponId: coupon?.id ?? null,
        subtotal: q.subtotal,
        discount: q.subtotal - q.total,
        total: q.total,
      },
    });
  });
}

export async function preparePayment(
  orderId: string,
  buyerId: string,
  provider: "test" | "paymob" | "manual" | "kashier",
) {
  await releaseExpiredOrders();
  return db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findFirst({
      where: { id: orderId, buyerId },
      include: { buyer: { select: { name: true, email: true, phone: true } } },
    });
    if (
      !order ||
      order.status !== "PENDING_PAYMENT" ||
      order.expiresAt <= new Date()
    )
      throw new OrderError("مدة الطلب انتهت، ابدأ طلب جديد");
    if (order.paymentProvider && order.paymentProvider !== provider)
      throw new OrderError("وسيلة الدفع للطلب مختلفة");
    // Freeze pricing before issuing a payable intention; coupon changes now fail.
    await tx.order.update({
      where: { id: order.id },
      data: { paymentProvider: provider },
    });
    return {
      id: order.id,
      number: order.number,
      total: order.total,
      buyer: order.buyer,
    };
  });
}

export async function markOrderPaid(
  orderId: string,
  payment: {
    provider: "test" | "paymob" | "manual" | "kashier";
    reference: string;
    amount: number;
  },
) {
  if (
    !payment.reference ||
    payment.reference.length > 256 ||
    !Number.isSafeInteger(payment.amount)
  )
    throw new OrderError("بيانات الدفع مش صحيحة");
  return db.$transaction(
    async (tx) => {
      // Serializes replay of the same provider transaction across different order IDs.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${payment.provider + ":" + payment.reference}, 0))::text`;
      await lockOrder(tx, orderId);
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: { seller: { select: { type: true, holdDays: true } } },
          },
        },
      });
      if (!order) return;
      if (order.status === "PAID") {
        if (
          order.paymentProvider !== payment.provider ||
          order.paymentRef !== payment.reference
        )
          console.error("Duplicate payment on paid order; refund required", {
            orderId,
          });
        return;
      }
      if (order.paymentProvider && order.paymentProvider !== payment.provider) {
        console.error(
          "Payment provider mismatch; order requires admin review",
          { orderId },
        );
        return;
      }
      if (
        await tx.order.findFirst({
          where: {
            id: { not: orderId },
            paymentProvider: payment.provider,
            paymentRef: payment.reference,
            status: { in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] },
          },
        })
      ) {
        console.error("Payment reference reused; order requires admin review", {
          orderId,
        });
        return;
      }
      // Expiry cancellation is reversible only for a confirmed late payment.
      if (order.status === "CANCELLED" && order.expiresAt < new Date())
        await tx.order.updateMany({
          where: { id: orderId, status: "CANCELLED" },
          data: { status: "PENDING_PAYMENT" },
        });
      const now = new Date();
      const changed = await tx.order.updateMany({
        where: { id: orderId, status: "PENDING_PAYMENT" },
        data: {
          status: "PAID",
          paidAt: now,
          paidAmount: payment.amount,
          paymentProvider: payment.provider,
          paymentRef: payment.reference,
        },
      });
      if (!changed.count) return;
      const result = await deliverPaidOrder(tx, orderId);
      if (result.error) {
        await releaseOrderStock(tx, orderId);
        await tx.order.updateMany({
          where: { id: orderId, status: "PAID" },
          data: { reviewReason: result.error },
        });
        console.error("Paid order NOT delivered; admin review required", {
          orderId,
          reason: result.error,
        });
      }
    },
    { timeout: 15000 },
  );
}

// All checks precede writes: an unsuccessful admin retry changes no data.
// The order lock serializes payment, admin retries and refunds.
export async function deliverPaidOrder(
  tx: Tx,
  orderId: string,
): Promise<{ error?: string; delivered?: boolean }> {
  await lockOrder(tx, orderId);
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { seller: { select: { type: true, holdDays: true } } },
      },
    },
  });
  if (!order || order.status !== "PAID")
    return { error: "الطلب مش مدفوع أو اتعالج قبل كده" };
  const item = order.items[0];
  if (!item || order.items.length !== 1)
    return { error: "بيانات تسليم الطلب ناقصة" };
  const sale = await tx.ledgerEntry.findFirst({
    where: { orderItemId: item.id, type: "SALE" },
  });
  if (item.deliveredAt && sale) return { delivered: false };
  if (item.deliveredAt || sale)
    return { error: "بيانات التسليم والأرباح محتاجة مراجعة" };
  if (order.paidAmount === null)
    return { error: "المبلغ المدفوع مش مسجل، راجع الدفع قبل التسليم" };
  if (order.paidAmount !== order.total)
    return { error: "المبلغ المدفوع مختلف عن إجمالي الطلب" };
  if (order.couponId) {
    await tx.$queryRaw`SELECT id FROM "Coupon" WHERE id = ${order.couponId} FOR UPDATE`;
    const coupon = await tx.coupon.findUniqueOrThrow({
      where: { id: order.couponId },
    });
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
      return { error: "الكوبون وصل للحد الأقصى للاستخدام" };
  }
  let extra: { id: string }[] = [];
  if (item.deliveryType === "UNIQUE_CODES") {
    const reserved = await tx.stockItem.count({
      where: { orderItemId: item.id, status: "RESERVED" },
    });
    const needed = item.quantity - reserved;
    if (needed < 0) return { error: "حجز المخزون محتاج مراجعة" };
    extra = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "StockItem" WHERE "productId" = ${item.productId} AND status = 'AVAILABLE' ORDER BY "createdAt", id LIMIT ${needed} FOR UPDATE SKIP LOCKED`;
    if (extra.length !== needed)
      return { error: "المخزون مش كفاية لتسليم الطلب" };
  } else if (!item.deliveryContent)
    return { error: "بيانات تسليم الطلب ناقصة" };
  const now = new Date();
  if (extra.length)
    await tx.stockItem.updateMany({
      where: { id: { in: extra.map((s) => s.id) }, status: "AVAILABLE" },
      data: { status: "RESERVED", orderItemId: item.id },
    });
  await tx.stockItem.updateMany({
    where: { orderItemId: item.id, status: "RESERVED" },
    data: { status: "SOLD", soldAt: now },
  });
  await tx.orderItem.updateMany({
    where: { id: item.id, deliveredAt: null },
    data: { deliveredAt: now },
  });
  await tx.product.update({
    where: { id: item.productId },
    data: { soldCount: { increment: item.quantity } },
  });
  if (order.couponId)
    await tx.coupon.update({
      where: { id: order.couponId },
      data: { usedCount: { increment: 1 } },
    });
  await tx.ledgerEntry.create({
    data: {
      sellerId: item.sellerId,
      type: "SALE",
      amount: item.sellerNet,
      availableAt: new Date(
        now.getTime() +
          (item.seller.holdDays ?? SELLER_TIERS[item.seller.type].holdDays) *
            86400000,
      ),
      orderItemId: item.id,
      note: `طلب #${order.number}`,
    },
  });
  await tx.order.updateMany({
    where: { id: orderId, status: "PAID" },
    data: { reviewReason: null },
  });
  await enqueueNotice(tx, item.sellerId, "sale", {
    orderId: order.id,
    orderNumber: order.number,
    title: item.title,
    amount: order.total,
  });
  if (
    item.deliveryType === "UNIQUE_CODES" &&
    (await tx.stockItem.count({
      where: { productId: item.productId, status: "AVAILABLE" },
    })) <= 3
  )
    await enqueueNotice(tx, item.sellerId, "stock.low", {
      productId: item.productId,
      title: item.title,
    });
  return { delivered: true };
}
