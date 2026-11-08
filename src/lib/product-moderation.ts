import "server-only";
import { z } from "zod";
import { db } from "./db";
import { enqueueNotice } from "./notifications";
import { STAFF_DENIED, staffMayNotTouch } from "./staff-scope";
export async function moderateProduct(
  actorId: string,
  input: { id: string; decision: "ACTIVE" | "REJECTED"; reviewNote: string },
) {
  const v = z
    .object({
      id: z.string().min(1).max(100),
      decision: z.enum(["ACTIVE", "REJECTED"]),
      reviewNote: z.string().trim().max(2000),
    })
    .parse(input);
  if (v.decision === "REJECTED" && !v.reviewNote)
    throw new Error("اكتب سبب الرفض");
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (actor?.role !== "ADMIN" || actor.suspendedAt)
      throw new Error("غير مسموح");
    // A staff admin can't approve products of their own store.
    if (actor.adminDataFrom) {
      const product = await tx.product.findUnique({
        where: { id: v.id },
        select: { seller: { select: { userId: true } } },
      });
      if (product && staffMayNotTouch(actor, { userIds: [product.seller.userId] }))
        throw new Error(STAFF_DENIED);
    }
    const changed = await tx.product.updateMany({
      where: {
        id: v.id,
        status: "PENDING_REVIEW",
        seller: { kycStatus: "APPROVED" },
      },
      data: {
        status: v.decision,
        reviewNote: v.decision === "REJECTED" ? v.reviewNote : null,
      },
    });
    if (changed.count) {
      const product = await tx.product.findUniqueOrThrow({
        where: { id: v.id },
      });
      await enqueueNotice(
        tx,
        product.sellerId,
        v.decision === "ACTIVE" ? "product.approved" : "product.rejected",
        { productId: product.id, title: product.title },
      );
    }
    return changed;
  });
}
