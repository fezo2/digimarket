import type { Prisma, Review } from "@prisma/client";
// Caller holds the order and seller locks; caches are updated atomically with the review.
export async function changeReviewCounts(
  tx: Prisma.TransactionClient,
  review: Pick<Review, "productId" | "sellerId" | "positive">,
  delta: number,
) {
  const data = review.positive
    ? { positiveReviews: { increment: delta } }
    : { negativeReviews: { increment: delta } };
  await tx.product.update({ where: { id: review.productId }, data });
  await tx.sellerProfile.update({ where: { id: review.sellerId }, data });
}
export async function hideRefundedReviews(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  const reviews = await tx.review.findMany({
    where: { orderItem: { orderId }, hiddenAt: null },
  });
  for (const review of reviews) {
    const changed = await tx.review.updateMany({
      where: { id: review.id, hiddenAt: null },
      data: { hiddenAt: new Date(), hiddenReason: "الطلب اترد" },
    });
    if (changed.count) await changeReviewCounts(tx, review, -1);
  }
}
