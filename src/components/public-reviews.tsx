import { db } from "@/lib/db";
export async function PublicReviews({
  productId,
  page = 1,
  size = 10,
}: {
  productId: string;
  page?: number;
  size?: number;
}) {
  const reviews = await db.review.findMany({
    where: { productId, hiddenAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * size,
    take: size,
    select: {
      id: true,
      positive: true,
      comment: true,
      sellerReply: true,
      createdAt: true,
      buyer: { select: { name: true } },
    },
  });
  return (
    <ul className="space-y-4">
      {reviews.map((r) => (
        <li className="border-b p-3" key={r.id}>
          <p>
            {r.positive ? "👍" : "👎"} {r.buyer.name.trim().split(/\s+/)[0]} ·{" "}
            {r.createdAt.toLocaleDateString("ar-EG")}
          </p>
          <p className="whitespace-pre-wrap break-words">{r.comment}</p>
          {r.sellerReply && (
            <p className="whitespace-pre-wrap break-words">
              رد التاجر: {r.sellerReply}
            </p>
          )}
        </li>
      ))}
      {!reviews.length && <li>لسه مفيش تقييمات.</li>}
    </ul>
  );
}
