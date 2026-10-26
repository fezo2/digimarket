import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { lockOrder } from "./orders";
import { lockSeller, refundOrder } from "./wallet";
import { participant, saveChatImage } from "./chat";
import { deletePrivateFile } from "./storage";
import { communityId, disputeReason, maskContact } from "./community-rules";
import { CommunityError, ParticipantError } from "./community-error";
import { z } from "zod";
async function lockBuyerDisputes(
  tx: Prisma.TransactionClient,
  buyerId: string,
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"dispute:" + buyerId}, 0))::text`;
}
export async function openDispute(
  userId: string,
  itemId: string,
  reason: string,
  image?: File,
) {
  communityId.parse(itemId);
  const value = disputeReason.parse(reason);
  const target = await db.orderItem.findFirst({
    where: { id: itemId, order: { buyerId: userId } },
    select: { orderId: true },
  });
  if (!target) throw new ParticipantError("الطلب مش موجود");
  await participant(db, userId, target.orderId);
  const attachmentKey = await saveChatImage(target.orderId, image);
  try {
    return await db.$transaction(async (tx) => {
      await lockOrder(tx, target.orderId);
      await lockBuyerDisputes(tx, userId);
      const item = await tx.orderItem.findUniqueOrThrow({
        where: { id: itemId },
        include: { order: true },
      });
      if (item.order.buyerId !== userId)
        throw new ParticipantError("الطلب مش موجود");
      if (
        item.order.status !== "PAID" ||
        !item.deliveredAt ||
        Date.now() > item.deliveredAt.getTime() + 7 * 86400000
      )
        throw new CommunityError(
          "الشكوى متاحة خلال ٧ أيام من تسليم الطلب المدفوع",
        );
      await lockSeller(tx, item.sellerId);
      if (
        (await tx.dispute.count({
          where: {
            buyerId: userId,
            status: "RESOLVED_NO_REFUND",
            resolvedAt: { gte: new Date(Date.now() - 90 * 86400000) },
          },
        })) >= 3
      )
        throw new CommunityError("تواصل مع الدعم");
      if (
        await tx.dispute.findFirst({
          where: { orderItemId: itemId, status: "OPEN" },
        })
      )
        throw new CommunityError("عندك شكوى مفتوحة للطلب ده بالفعل");
      const dispute = await tx.dispute.create({
        data: { orderItemId: itemId, buyerId: userId, reason: value },
      });
      await tx.message.create({
        data: {
          orderId: item.orderId,
          senderId: userId,
          ...maskContact("[النظام] اتفتحت شكوى: " + value),
          attachmentKey,
        },
      });
      return dispute.id;
    });
  } catch (error) {
    if (attachmentKey) await deletePrivateFile(attachmentKey);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new CommunityError("عندك شكوى مفتوحة للطلب ده بالفعل");
    throw error;
  }
}
export async function closeDispute(userId: string, disputeId: string) {
  communityId.parse(disputeId);
  return db.$transaction(async (tx) => {
    const dispute = await tx.dispute.findFirst({
      where: { id: disputeId, buyerId: userId },
      include: { orderItem: { select: { orderId: true, sellerId: true } } },
    });
    if (!dispute) throw new ParticipantError("الشكوى مش موجودة");
    await lockOrder(tx, dispute.orderItem.orderId);
    await lockSeller(tx, dispute.orderItem.sellerId);
    const changed = await tx.dispute.updateMany({
      where: { id: disputeId, buyerId: userId, status: "OPEN" },
      data: {
        status: "CLOSED_BY_BUYER",
        resolvedAt: new Date(),
        resolvedById: userId,
      },
    });
    if (!changed.count) return false;
    await tx.message.create({
      data: {
        orderId: dispute.orderItem.orderId,
        senderId: userId,
        body: "[النظام] المشتري أكد إن المشكلة اتحلت",
      },
    });
    return true;
  });
}
export async function resolveDispute(
  userId: string,
  disputeId: string,
  refund: boolean,
  note: string,
) {
  communityId.parse(disputeId);
  z.boolean().parse(refund);
  const value = z.string().trim().min(1).max(1000).parse(note);
  return db.$transaction(async (tx) => {
    if ((await tx.user.findUnique({ where: { id: userId } }))?.role !== "ADMIN")
      throw new ParticipantError("غير مسموح");
    const target = await tx.dispute.findUnique({
      where: { id: disputeId },
      include: { orderItem: { select: { orderId: true, sellerId: true } } },
    });
    if (!target) throw new ParticipantError("الشكوى مش موجودة");
    await lockOrder(tx, target.orderItem.orderId);
    await lockBuyerDisputes(tx, target.buyerId);
    await lockSeller(tx, target.orderItem.sellerId);
    const dispute = await tx.dispute.findUniqueOrThrow({
      where: { id: disputeId },
    });
    if (dispute.status !== "OPEN") return false;
    if (refund) {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: target.orderItem.orderId },
      });
      if (!["PAID", "REFUNDED"].includes(order.status))
        throw new CommunityError("حالة الطلب مش مناسبة للاسترداد");
      await refundOrder(userId, order.id, value, tx);
    }
    const status = refund ? "RESOLVED_REFUND" : "RESOLVED_NO_REFUND";
    const changed = await tx.dispute.updateMany({
      where: { id: disputeId, status: "OPEN" },
      data: {
        status,
        resolution: value,
        resolvedById: userId,
        resolvedAt: new Date(),
      },
    });
    if (!changed.count) return false;
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: "dispute.resolved",
        targetId: disputeId,
        data: JSON.stringify({ status }),
      },
    });
    await tx.message.create({
      data: {
        orderId: target.orderItem.orderId,
        senderId: userId,
        body: `[النظام] ${refund ? "اتردّت الفلوس للمشتري" : "الشكوى اترفضت"}: ${value}`,
      },
    });
    return true;
  });
}
export const disputeLabels = {
  OPEN: "مفتوحة",
  RESOLVED_REFUND: "اتردّت الفلوس",
  RESOLVED_NO_REFUND: "مرفوضة",
  CLOSED_BY_BUYER: "المشكلة اتحلت",
};
