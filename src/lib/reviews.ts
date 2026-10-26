import "server-only";
import { db } from "./db";
import { lockOrder } from "./orders";
import { lockSeller } from "./wallet";
import { changeReviewCounts } from "./review-cache";
import {
  communityId,
  reviewInput,
  canReview,
  canEditReview,
} from "./community-rules";
import { CommunityError, ParticipantError } from "./community-error";
import { z } from "zod";
export async function writeReview(
  userId: string,
  itemId: string,
  input: z.input<typeof reviewInput>,
  mode: "create" | "edit" = "create",
) {
  communityId.parse(itemId);
  const value = reviewInput.parse(input);
  z.enum(["create", "edit"]).parse(mode);
  return db.$transaction(async (tx) => {
    const target = await tx.orderItem.findUnique({
      where: { id: itemId },
      select: { orderId: true },
    });
    if (!target) throw new ParticipantError("الطلب مش موجود");
    await lockOrder(tx, target.orderId);
    const item = await tx.orderItem.findUniqueOrThrow({
      where: { id: itemId },
      include: { order: true, review: true },
    });
    if (item.order.buyerId !== userId)
      throw new ParticipantError("الطلب مش موجود");
    if (!canReview(item.order.status, item.deliveredAt))
      throw new CommunityError(
        "التقييم متاح بعد التسليم لمدة ٣٠ يوم للطلب المدفوع",
      );
    await lockSeller(tx, item.sellerId);
    if (mode === "create" && item.review)
      throw new CommunityError("التقييم اتسجل قبل كده");
    if (mode === "edit" && !item.review)
      throw new CommunityError("التقييم مش موجود");
    if (item.review) {
      if (
        item.review.hiddenAt ||
        !canEditReview(item.review.createdAt, item.review.editedOnce)
      )
        throw new CommunityError("مسموح تعديل التقييم مرة واحدة خلال ٧ أيام");
      const updated = await tx.review.updateMany({
        where: { id: item.review.id, editedOnce: false, hiddenAt: null },
        data: { ...value, editedOnce: true, updatedAt: new Date() },
      });
      if (!updated.count) return;
      if (item.review.positive !== value.positive) {
        await changeReviewCounts(tx, item.review, -1);
        await changeReviewCounts(
          tx,
          { ...item.review, positive: value.positive },
          1,
        );
      }
    } else {
      const review = await tx.review.create({
        data: {
          ...value,
          orderItemId: itemId,
          productId: item.productId,
          sellerId: item.sellerId,
          buyerId: userId,
        },
      });
      await changeReviewCounts(tx, review, 1);
    }
  });
}
export async function replyReview(
  userId: string,
  reviewId: string,
  body: string,
) {
  communityId.parse(reviewId);
  const reply = z.string().trim().min(1).max(1000).parse(body);
  return db.$transaction(async (tx) => {
    const target = await tx.review.findUnique({
      where: { id: reviewId },
      include: { orderItem: { select: { orderId: true } } },
    });
    if (!target) throw new ParticipantError("التقييم مش موجود");
    await lockOrder(tx, target.orderItem.orderId);
    const review = await tx.review.findFirst({
      where: { id: reviewId, seller: { userId }, hiddenAt: null },
    });
    if (!review) throw new ParticipantError("التقييم مش موجود");
    const changed = await tx.review.updateMany({
      where: { id: reviewId, sellerReplyAt: null, sellerReply: null },
      data: { sellerReply: reply, sellerReplyAt: new Date() },
    });
    if (!changed.count) throw new CommunityError("الرد اتسجل قبل كده");
  });
}
export async function moderateReview(
  userId: string,
  reviewId: string,
  hide: boolean,
  reason: string,
) {
  communityId.parse(reviewId);
  z.boolean().parse(hide);
  const note = z.string().trim().min(1).max(1000).parse(reason);
  return db.$transaction(async (tx) => {
    if ((await tx.user.findUnique({ where: { id: userId } }))?.role !== "ADMIN")
      throw new ParticipantError("غير مسموح");
    const target = await tx.review.findUnique({
      where: { id: reviewId },
      include: { orderItem: { select: { orderId: true } } },
    });
    if (!target) throw new ParticipantError("التقييم مش موجود");
    await lockOrder(tx, target.orderItem.orderId);
    await lockSeller(tx, target.sellerId);
    const review = await tx.review.findUniqueOrThrow({
      where: { id: reviewId },
      include: { orderItem: { include: { order: true } } },
    });
    if (!hide && review.orderItem.order.status !== "PAID")
      throw new CommunityError("مينفعش إظهار تقييم طلب اترد");
    const changed = await tx.review.updateMany({
      where: { id: reviewId, hiddenAt: hide ? null : { not: null } },
      data: {
        hiddenAt: hide ? new Date() : null,
        hiddenReason: hide ? note : null,
      },
    });
    if (!changed.count) return false;
    await changeReviewCounts(tx, review, hide ? -1 : 1);
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: hide ? "review.hidden" : "review.unhidden",
        targetId: reviewId,
        data: JSON.stringify({ hidden: hide }),
      },
    });
    return true;
  });
}
