import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatEGP } from "@/lib/money";

export const metadata = { title: "حسابي" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  const orders = await db.order.findMany({
    where: { buyerId: user.id, status: { not: "PENDING_PAYMENT" } },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { title: true, quantity: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">أهلاً {user.name}</h1>
        <p className="text-sm text-slate-500" dir="ltr">{user.email}</p>
      </div>
      <div className="card p-6">
        <h2 className="mb-4 font-bold">مكتبتي (مشترياتي)</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-slate-500">
            لسه ماشتريتش حاجة. <Link href="/" className="font-semibold text-brand-600">ابدأ التسوق</Link>
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-3 text-sm">
                <span>
                  طلب #{o.number} · {o.items.map((i) => i.title).join("، ")}
                </span>
                <span className="font-semibold">{formatEGP(o.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!user.seller && (
        <div className="card flex flex-wrap items-center gap-3 p-6">
          <p className="flex-1">عندك منتجات رقمية عايز تبيعها؟</p>
          <Link href="/seller/join" className="btn-primary">ابدأ البيع</Link>
        </div>
      )}
    </div>
  );
}
