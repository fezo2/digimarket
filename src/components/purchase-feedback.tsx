import { db } from "@/lib/db";
import { canReview, canEditReview } from "@/lib/community-rules";
import { disputeLabels } from "@/lib/disputes";
import { ActionForm } from "./action-form";
import {
  submitReview,
  submitDispute,
  solveDispute,
} from "@/app/account/orders/[id]/actions";
export async function PurchaseFeedback({
  orderId,
  userId,
}: {
  orderId: string;
  userId: string;
}) {
  const items = await db.orderItem.findMany({
    where: { orderId, order: { buyerId: userId } },
    include: {
      order: { select: { status: true } },
      review: true,
      disputes: { orderBy: { createdAt: "desc" } },
    },
  });
  return (
    <>
      {items.map((item) => (
        <section className="card space-y-5 p-5" key={item.id}>
          <h2 className="text-xl font-bold">تقييم وشكاوى: {item.title}</h2>
          {item.review && (
            <div>
              <p>
                {item.review.positive ? "👍" : "👎"}{" "}
                {item.review.hiddenAt && "(مخفي)"}
              </p>
              <p className="whitespace-pre-wrap">{item.review.comment}</p>
              {item.review.sellerReply && (
                <p className="whitespace-pre-wrap">
                  رد التاجر: {item.review.sellerReply}
                </p>
              )}
            </div>
          )}
          {canReview(item.order.status, item.deliveredAt) &&
            (!item.review ||
              (!item.review.hiddenAt &&
                canEditReview(
                  item.review.createdAt,
                  item.review.editedOnce,
                ))) && (
              <ActionForm
                action={submitReview}
                button={item.review ? "عدّل التقييم" : "قيّم الشراء"}
              >
                <input type="hidden" name="itemId" value={item.id} />
                <input
                  type="hidden"
                  name="mode"
                  value={item.review ? "edit" : "create"}
                />
                <label className="label">
                  رأيك
                  <select
                    className="input"
                    name="positive"
                    defaultValue={String(item.review?.positive ?? true)}
                  >
                    <option value="true">👍 إيجابي</option>
                    <option value="false">👎 سلبي</option>
                  </select>
                </label>
                <label className="label">
                  تعليق اختياري
                  <textarea
                    className="input"
                    name="comment"
                    maxLength={1000}
                    defaultValue={item.review?.comment ?? ""}
                  />
                </label>
              </ActionForm>
            )}
          {item.disputes.map((d) => (
            <div key={d.id}>
              <p>الشكوى: {disputeLabels[d.status]}</p>
              <p className="whitespace-pre-wrap">{d.reason}</p>
              <p className="whitespace-pre-wrap">{d.resolution}</p>
              {d.status === "OPEN" && (
                <ActionForm action={solveDispute} button="المشكلة اتحلت">
                  <input type="hidden" name="disputeId" value={d.id} />
                </ActionForm>
              )}
            </div>
          ))}
          {item.order.status === "PAID" &&
            item.deliveredAt &&
            Date.now() <= item.deliveredAt.getTime() + 7 * 86400000 &&
            !item.disputes.some((d) => d.status === "OPEN") && (
              <ActionForm action={submitDispute} button="افتح شكوى">
                <input type="hidden" name="itemId" value={item.id} />
                <label className="label">
                  سبب الشكوى
                  <textarea
                    className="input"
                    name="reason"
                    required
                    minLength={20}
                    maxLength={2000}
                  />
                </label>
                <label className="label">
                  صورة للمشكلة
                  <input
                    className="input"
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                  />
                </label>
              </ActionForm>
            )}
        </section>
      ))}
    </>
  );
}
