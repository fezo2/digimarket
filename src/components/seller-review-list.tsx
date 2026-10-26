import Link from "next/link";
import { db } from "@/lib/db";
import { ActionForm } from "./action-form";
import { sendReply } from "@/app/seller/reviews/actions";
export async function SellerReviewList({
  sellerId,
  orderId,
  filter,
}: {
  sellerId: string;
  orderId?: string;
  filter?: string;
}) {
  const reviews = await db.review.findMany({
    where: {
      sellerId,
      hiddenAt: null,
      ...(orderId ? { orderItem: { orderId } } : {}),
      ...(filter === "positive"
        ? { positive: true }
        : filter === "negative"
          ? { positive: false }
          : filter === "unanswered"
            ? { sellerReplyAt: null, sellerReply: null }
            : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { orderItem: { select: { orderId: true, title: true } } },
  });
  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <section className="card space-y-3 p-4" key={r.id}>
          <Link
            className="underline"
            href={`/seller/sales/${r.orderItem.orderId}`}
          >
            {r.orderItem.title}
          </Link>
          <p>{r.positive ? "👍" : "👎"}</p>
          <p className="whitespace-pre-wrap">{r.comment}</p>
          <p className="whitespace-pre-wrap">{r.sellerReply}</p>
          {!r.sellerReplyAt && !r.sellerReply && (
            <ActionForm action={sendReply} button="رد على التقييم">
              <input type="hidden" name="reviewId" value={r.id} />
              <label className="label">
                رد التاجر
                <textarea
                  className="input"
                  name="reply"
                  required
                  maxLength={1000}
                />
              </label>
            </ActionForm>
          )}
        </section>
      ))}
      {!reviews.length && <p>مفيش تقييمات بالحالة دي.</p>}
    </div>
  );
}
