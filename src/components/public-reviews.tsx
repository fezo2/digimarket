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
    <ul className="divide-y divide-slate-100">
      {reviews.map((r) => (
        <li className="flex gap-3 py-4" key={r.id}>
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${r.positive ? "bg-emerald-50" : "bg-red-50"}`}
          >
            {r.positive ? "👍" : "👎"}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm">
            <span className="font-semibold">{r.buyer.name.trim().split(/\s+/)[0]}</span>
            <span className="text-slate-400"> · {day(r.createdAt)}</span>
          </p>
          <p className="whitespace-pre-wrap break-words text-slate-700">{r.comment}</p>
          {r.sellerReply && (
            <p className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              {t("رد التاجر: ")}{r.sellerReply}
            </p>
          )}
          </div>
        </li>
      ))}
      {!reviews.length && <li className="py-4 text-slate-500">{t("لسه مفيش تقييمات.")}</li>}
    </ul>
  );
}
