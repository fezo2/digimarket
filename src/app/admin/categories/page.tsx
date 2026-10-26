import { db } from "@/lib/db";
import { updateCommission } from "../actions";

export const metadata = { title: "الأقسام والعمولات" };

export default async function CategoriesAdmin() {
  const categories = await db.category.findMany({
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
    include: { parent: { select: { nameAr: true } }, _count: { select: { products: true } } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">الأقسام والعمولات</h1>
      <p className="text-sm text-slate-600">عمولة المنصة بتتحسب على كل بيعة حسب قسم المنتج، وبتتثبّت على الطلب وقت الشراء.</p>
      <div className="card divide-y divide-slate-100">
        {categories.map((c) => (
          <form key={c.id} action={updateCommission} className="flex flex-wrap items-center gap-3 p-4">
            <input type="hidden" name="id" value={c.id} />
            <span className="text-xl">{c.icon}</span>
            <div className="flex-1">
              <p className="font-semibold">{c.nameAr}</p>
              <p className="text-xs text-slate-500">
                {c.parent ? `جوا ${c.parent.nameAr} · ` : ""}
                {c._count.products} منتج
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              العمولة
              <input
                name="percent"
                type="number"
                step="0.5"
                min={0}
                max={50}
                defaultValue={c.commissionBps / 100}
                className="input w-24"
                dir="ltr"
              />
              %
            </label>
            <button className="btn-outline">حفظ</button>
          </form>
        ))}
      </div>
    </div>
  );
}
