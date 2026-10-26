import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { changeVisibility } from "./actions";
export default async function Page() {
  await requireAdmin();
  const reviews = await db.review.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { product: { select: { title: true } } },
  });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">مراجعة التقييمات</h1>
      {reviews.map((r) => (
        <section key={r.id} className="card space-y-3 p-5">
          <h2>
            {r.product.title} · {r.positive ? "👍" : "👎"}
          </h2>
          <p className="whitespace-pre-wrap">{r.comment}</p>
          <p className="whitespace-pre-wrap">{r.sellerReply}</p>
          <p>الحالة: {r.hiddenAt ? "مخفي" : "ظاهر"}</p>
          <p className="whitespace-pre-wrap">{r.hiddenReason}</p>
          <ActionForm
            action={changeVisibility}
            button={r.hiddenAt ? "إظهار التقييم" : "إخفاء التقييم"}
          >
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="hide" value={String(!r.hiddenAt)} />
            <label className="label">
              سبب الإجراء
              <textarea
                className="input"
                name="reason"
                required
                maxLength={1000}
              />
            </label>
          </ActionForm>
        </section>
      ))}
    </div>
  );
}
