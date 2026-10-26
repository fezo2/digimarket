import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { changeVisibility } from "./actions";

const FILTERS: Record<string, Prisma.ReviewWhereInput> = {
  negative: { positive: false },
  positive: { positive: true },
  hidden: { hiddenAt: { not: null } },
  replied: { sellerReply: { not: null } },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  await requireAdmin();
  const { filter = "", q = "" } = await searchParams;
  const term = q.trim().slice(0, 100);
  const reviews = await db.review.findMany({
    where: {
      ...(FILTERS[filter] ?? {}),
      ...(term
        ? {
            OR: [
              { comment: { contains: term, mode: "insensitive" } },
              { product: { title: { contains: term, mode: "insensitive" } } },
              { seller: { storeName: { contains: term, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      product: { select: { title: true } },
      seller: { select: { id: true, storeName: true } },
      buyer: { select: { id: true, name: true } },
    },
  });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">تعليقات وتقييمات العملاء</h1>
      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={term}
          className="input max-w-sm"
          placeholder="ابحث في التعليق أو المنتج أو المتجر"
        />
        <select name="filter" defaultValue={filter} className="input w-auto">
          <option value="">الكل</option>
          <option value="negative">سلبية</option>
          <option value="positive">إيجابية</option>
          <option value="hidden">مخفية</option>
          <option value="replied">التاجر رد عليها</option>
        </select>
        <button className="btn-primary">عرض</button>
      </form>
      {reviews.map((r) => (
        <section key={r.id} className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-bold">
              {r.positive ? "👍" : "👎"} {r.product.title}
            </h2>
            <Link className="text-sm text-brand-600" href={`/admin/sellers/${r.seller.id}`}>
              {r.seller.storeName}
            </Link>
            <Link className="text-sm text-slate-600" href={`/admin/users/${r.buyer.id}`}>
              من {r.buyer.name}
            </Link>
            {r.hiddenAt && <span className="badge bg-slate-100">مخفي</span>}
            <span className="ms-auto text-sm text-slate-500">
              {r.createdAt.toLocaleDateString("ar-EG")}
            </span>
          </div>
          {r.comment && <p className="whitespace-pre-wrap">{r.comment}</p>}
          {r.sellerReply && (
            <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm">
              رد التاجر: {r.sellerReply}
            </p>
          )}
          {r.hiddenReason && (
            <p className="text-sm text-slate-500">سبب الإخفاء: {r.hiddenReason}</p>
          )}
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              {r.hiddenAt ? "إظهار التقييم" : "إخفاء التقييم"}
            </summary>
            <ActionForm
              action={changeVisibility}
              button={r.hiddenAt ? "إظهار التقييم" : "إخفاء التقييم"}
            >
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="hide" value={String(!r.hiddenAt)} />
              <label className="label">
                سبب الإجراء
                <textarea className="input" name="reason" required maxLength={1000} />
              </label>
            </ActionForm>
          </details>
        </section>
      ))}
      {!reviews.length && <p className="text-slate-500">مفيش تقييمات</p>}
    </div>
  );
}
