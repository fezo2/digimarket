import { frozenAmount } from "./dispute-balance";
import { hideRefundedReviews } from "./review-cache";
import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { enqueueNotice } from "./notifications";
import { db } from "./db";
import { sellerBalance } from "./ledger";
import { MIN_PAYOUT } from "./config";
import { formatEGP } from "./money";
import {
  destinationSchema,
  passwordSchema,
  noteSchema,
  idSchema,
  payoutUnlockAt,
} from "./wallet-validation";
import { deliverPaidOrder, lockOrder, releaseOrderStock } from "./orders";

export class WalletError extends Error {}
type Tx = Prisma.TransactionClient;
export async function lockSeller(tx: Tx, sellerId: string) {
  await tx.$queryRaw`SELECT id FROM "SellerProfile" WHERE id = ${sellerId} FOR UPDATE`;
}
async function admin(tx: Tx, actorId: string) {
  const actor = await tx.user.findUnique({ where: { id: actorId } });
  if (!actor || actor.role !== "ADMIN") throw new WalletError("غير مسموح");
  return actor;
}
async function audit(
  tx: Tx,
  actorId: string,
  action: string,
  targetId: string,
  data?: Record<string, string | number>,
) {
  await tx.auditLog.create({
    data: {
      actorId,
      action,
      targetId,
      data: data ? JSON.stringify(data) : null,
    },
  });
}
export async function saveDestination(
  userId: string,
  input: z.input<typeof destinationSchema>,
  password: string,
) {
  const value = destinationSchema.parse(input);
  passwordSchema.parse(password);
  return db.$transaction(async (tx) => {
    const owner = await tx.sellerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!owner) throw new WalletError("المتجر مش موجود");
    await lockSeller(tx, owner.id);
    const seller = await tx.sellerProfile.findUniqueOrThrow({
      where: { id: owner.id },
      include: { user: true },
    });
    if (!(await bcrypt.compare(password, seller.user.passwordHash)))
      throw new WalletError("الباسورد الحالي مش صحيح");
    if (
      seller.payoutMethod === value.method &&
      seller.payoutAccount === value.account &&
      seller.payoutHolderName === value.holderName
    )
      return;
    await tx.sellerProfile.update({
      where: { id: seller.id },
      data: {
        payoutMethod: value.method,
        payoutAccount: value.account,
        payoutHolderName: value.holderName,
        payoutUpdatedAt: new Date(),
      },
    });
    await audit(tx, userId, "seller.payout_account_changed", seller.id, {
      method: value.method,
      accountLast4: value.account.slice(-4),
    });
  });
}
export async function requestPayout(userId: string, amount: number) {
  z.number().int().min(1).max(999999999).parse(amount);
  try {
    return await db.$transaction(async (tx) => {
      const owner = await tx.sellerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!owner) throw new WalletError("المتجر مش موجود");
      await lockSeller(tx, owner.id);
      const seller = await tx.sellerProfile.findUniqueOrThrow({
        where: { id: owner.id },
      });
      if (seller.kycStatus !== "APPROVED")
        throw new WalletError("لازم توثيق المتجر يتوافق عليه الأول");
      if (seller.payoutsFrozenAt)
        throw new WalletError(
          "السحب متجمّد من الإدارة" +
            (seller.payoutsFrozenReason ? `: ${seller.payoutsFrozenReason}` : ""),
        );
      // Amount problems come first: they are what the seller can act on now.
      if (amount < MIN_PAYOUT)
        throw new WalletError(
          `الحد الأدنى للسحب ${formatEGP(MIN_PAYOUT)}`,
        );
      const balance = await sellerBalance(seller.id, tx);
      const withdrawable = balance.available - (await frozenAmount(seller.id, tx));
      if (amount > withdrawable)
        throw new WalletError(
          `الرصيد المتاح للسحب ${formatEGP(Math.max(0, withdrawable))} بس، والفلوس المعلّقة مينفعش تتسحب لحد ما تتاح`,
        );
      if (
        !seller.payoutMethod ||
        !seller.payoutAccount ||
        !seller.payoutHolderName ||
        !seller.payoutUpdatedAt
      )
        throw new WalletError("احفظ بيانات استلام الأرباح الأول");
      if (payoutUnlockAt(seller.payoutUpdatedAt) > new Date())
        throw new WalletError(
          "السحب مقفول لمدة ٢٤ ساعة بعد تغيير بيانات الحساب",
        );
      if (
        await tx.payout.findFirst({
          where: { sellerId: seller.id, status: "REQUESTED" },
        })
      )
        throw new WalletError("عندك طلب سحب قيد المراجعة بالفعل");
      const payout = await tx.payout.create({
        data: {
          sellerId: seller.id,
          amount,
          method: seller.payoutMethod,
          account: seller.payoutAccount,
          holderName: seller.payoutHolderName,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          sellerId: seller.id,
          type: "PAYOUT",
          amount: -amount,
          availableAt: new Date(),
          payoutId: payout.id,
          note: "طلب سحب",
        },
      });
      return payout.id;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new WalletError("عندك طلب سحب قيد المراجعة بالفعل");
    throw error;
  }
}
export async function processPayout(
  actorId: string,
  payoutId: string,
  status: "PAID" | "REJECTED",
  text: string,
) {
  idSchema.parse(payoutId);
  z.enum(["PAID", "REJECTED"]).parse(status);
  const value = (status === "PAID" ? noteSchema.max(100) : noteSchema).parse(
    text,
  );
  return db.$transaction(async (tx) => {
    await admin(tx, actorId);
    const payout = await tx.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new WalletError("طلب السحب مش موجود");
    await lockSeller(tx, payout.sellerId);
    const changed = await tx.payout.updateMany({
      where: { id: payoutId, status: "REQUESTED" },
      data: {
        status,
        processedAt: new Date(),
        processedById: actorId,
        ...(status === "PAID" ? { reference: value } : { rejectReason: value }),
      },
    });
    if (!changed.count) return false;
    if (status === "REJECTED")
      await tx.ledgerEntry.create({
        data: {
          sellerId: payout.sellerId,
          type: "PAYOUT",
          amount: payout.amount,
          availableAt: new Date(),
          payoutId,
          note: "إلغاء طلب السحب المرفوض",
        },
      });
    await audit(
      tx,
      actorId,
      status === "PAID" ? "payout.paid" : "payout.rejected",
      payoutId,
      { amount: payout.amount },
    );
    await enqueueNotice(
      tx,
      payout.sellerId,
      status === "PAID" ? "payout.paid" : "payout.rejected",
      { amount: payout.amount },
    );
    return true;
  });
}
export async function refundOrder(
  actorId: string,
  orderId: string,
  note: string,
  transaction?: Tx,
) {
  idSchema.parse(orderId);
  const value = noteSchema.parse(note);
  const execute = async (tx: Tx) => {
    await admin(tx, actorId);
    const order = await refundPaidOrder(tx, actorId, orderId, value, "order.refunded");
    if (!order) return false;
    await tx.order.update({ where: { id: orderId }, data: { refundPaidAt: new Date() } });
    return true;
  };
  return transaction ? execute(transaction) : db.$transaction(execute);
}

// The seller refunds a buyer from their own panel. The sale comes back out
// of the seller's balance and the admin pays the buyer back by hand.
export async function sellerRefundOrder(
  userId: string,
  orderId: string,
  note: string,
) {
  idSchema.parse(orderId);
  const value = noteSchema.parse(note);
  return db.$transaction(async (tx) => {
    const seller = await tx.sellerProfile.findUnique({ where: { userId } });
    if (!seller) throw new WalletError("غير مسموح");
    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { sellerId: true },
    });
    if (!items.some((i) => i.sellerId === seller.id))
      throw new WalletError("الطلب مش موجود");
    if (items.some((i) => i.sellerId !== seller.id))
      throw new WalletError(
        "الطلب فيه منتجات من متاجر تانية، كلم الإدارة عشان تعمل الاسترداد",
      );
    const order = await refundPaidOrder(
      tx,
      userId,
      orderId,
      value,
      "order.refunded_by_seller",
    );
    if (!order) return null;
    // A refund settles any open complaint on the order.
    await tx.dispute.updateMany({
      where: { orderItem: { orderId }, status: "OPEN" },
      data: {
        status: "RESOLVED_REFUND",
        resolution: value,
        resolvedById: userId,
        resolvedAt: new Date(),
      },
    });
    await tx.message.create({
      data: {
        orderId,
        senderId: userId,
        kind: "SYSTEM",
        body: `التاجر رجّع فلوس الطلب، والإدارة هتحوّلها لك: ${value}`,
      },
    });
    return order;
  });
}

// Admin confirms the money from a seller refund reached the buyer.
export async function markRefundPaid(actorId: string, orderId: string) {
  idSchema.parse(orderId);
  return db.$transaction(async (tx) => {
    await admin(tx, actorId);
    const changed = await tx.order.updateMany({
      where: { id: orderId, status: "REFUNDED", refundPaidAt: null },
      data: { refundPaidAt: new Date() },
    });
    if (!changed.count) return false;
    await audit(tx, actorId, "order.refund_paid", orderId);
    return true;
  });
}

async function refundPaidOrder(
  tx: Tx,
  actorId: string,
  orderId: string,
  note: string,
  action: string,
) {
  await lockOrder(tx, orderId);
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new WalletError("الطلب مش موجود");
  if (order.status !== "PAID") return false;
  for (const sellerId of [...new Set(order.items.map((i) => i.sellerId))].sort())
    await lockSeller(tx, sellerId);
  const changed = await tx.order.updateMany({
    where: { id: orderId, status: "PAID" },
    data: { status: "REFUNDED", refundedAt: new Date(), refundNote: note },
  });
  if (!changed.count) return false;
  await releaseOrderStock(tx, orderId);
  for (const item of order.items) {
    await tx.orderItem.update({
      where: { id: item.id },
      data: { refundedAmount: item.total },
    });
    const sale = await tx.ledgerEntry.findFirst({
      where: { orderItemId: item.id, type: "SALE" },
      orderBy: { createdAt: "asc" },
    });
    if (sale)
      await tx.ledgerEntry.create({
        data: {
          sellerId: item.sellerId,
          type: "REFUND",
          amount: -item.sellerNet,
          availableAt: sale.availableAt,
          orderItemId: item.id,
          note: `استرداد طلب #${order.number}`,
        },
      });
    if (item.deliveredAt)
      await tx.product.update({
        where: { id: item.productId },
        data: { soldCount: { decrement: item.quantity } },
      });
  }
  await hideRefundedReviews(tx, orderId);
  await audit(tx, actorId, action, orderId, { amount: order.total });
  return order;
}
export async function redeliverOrder(actorId: string, orderId: string) {
  idSchema.parse(orderId);
  // A resold item is bought again from the supplier (after the admin topped
  // up the balance, say) before the usual delivery.
  const resold = await db.orderItem.findFirst({
    where: { orderId, supplier: { not: null }, deliveredAt: null },
    select: { id: true },
  });
  if (resold) {
    await db.$transaction((tx) => admin(tx, actorId));
    const { fulfilSupplierOrder } = await import("./supplier");
    const r = await fulfilSupplierOrder(orderId, { retryFailed: true });
    if (r.error) throw new WalletError(r.error);
    if (r.pending)
      throw new WalletError("المورد لسه بيجهّز الطلب، جرّب كمان شوية");
    if (r.delivered)
      await db.$transaction((tx) => audit(tx, actorId, "order.redelivered", orderId));
    return Boolean(r.delivered);
  }
  return db.$transaction(
    async (tx) => {
      await admin(tx, actorId);
      const result = await deliverPaidOrder(tx, orderId);
      if (result.error) throw new WalletError(result.error);
      if (result.delivered)
        await audit(tx, actorId, "order.redelivered", orderId);
      return Boolean(result.delivered);
    },
    { timeout: 15000 },
  );
}
export async function adjustLedger(
  actorId: string,
  sellerId: string,
  amount: number,
  note: string,
  password: string,
) {
  idSchema.parse(sellerId);
  z.number()
    .int()
    .min(-999999999)
    .max(999999999)
    .refine((n) => n !== 0)
    .parse(amount);
  const value = noteSchema.parse(note);
  passwordSchema.parse(password);
  return db.$transaction(async (tx) => {
    const actor = await admin(tx, actorId);
    if (!(await bcrypt.compare(password, actor.passwordHash)))
      throw new WalletError("الباسورد الحالي مش صحيح");
    await lockSeller(tx, sellerId);
    if (!(await tx.sellerProfile.findUnique({ where: { id: sellerId } })))
      throw new WalletError("المتجر مش موجود");
    const entry = await tx.ledgerEntry.create({
      data: {
        sellerId,
        type: "ADJUSTMENT",
        amount,
        availableAt: new Date(),
        note: value,
      },
    });
    await audit(tx, actorId, "ledger.adjustment", sellerId, {
      amount,
      entryId: entry.id,
    });
  });
}
