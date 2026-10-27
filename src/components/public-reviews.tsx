import { i18n } from "@/lib/prefs";
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
  const { t, day } = await i18n();
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
            {day(r.createdAt)}
          </p>
          <p className="whitespace-pre-wrap break-words">{r.comment}</p>
          {r.sellerReply && (
            <p className="whitespace-pre-wrap break-words">
              {t("رد التاجر: ")}{r.sellerReply}
            </p>
          )}
        </li>
      ))}
      {!reviews.length && <li>{t("لسه مفيش تقييمات.")}</li>}
    </ul>
  );
}
