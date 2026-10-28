import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { siteHref } from "@/lib/sites";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { orderStatusLabels } from "@/lib/order-snapshot";
import { releaseExpiredOrders } from "@/lib/orders";
import { logout } from "@/app/(auth)/actions";

export async function generateMetadata() {
  return { title: (await i18n()).t("حسابي") };
}

export default async function AccountPage() {
  const { t, money } = await i18n();
  const user = await requireUser("/account");
  await releaseExpiredOrders();
  const orders = await db.order.findMany({
    where: { buyerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { title: true, quantity: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">{t("أهلاً ")}{user.name}</h1>
        <p className="text-sm text-slate-500"><span dir="ltr">{user.email}</span></p>
        <div className="mt-1 flex items-center gap-4">
          <Link href="/account/security" className="text-sm font-semibold text-brand-600">{t("تغيير الباسورد")}</Link>
          {/* The header's log-out button is hidden on phones. */}
          <form action={logout} className="md:hidden">
            <button className="text-sm font-semibold text-red-600">{t("خروج")}</button>
          </form>
        </div>
      </div>
      <div className="card p-6">
        <h2 className="mb-4 font-bold">{t("مكتبتي (مشترياتي)")}</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-slate-500">
            {t("لسه ماشتريتش حاجة. ")}<Link href="/" className="font-semibold text-brand-600">{t("ابدأ التسوق")}</Link>
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-3 text-sm">
                <Link href={`/account/orders/${o.id}`} className="font-semibold text-brand-600">
                  {t("طلب #")}{o.number} · {o.items.map((i) => i.title).join(t("، "))} · {t(orderStatusLabels[o.status])}
                </Link>
                <span className="font-semibold">{money(o.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!user.seller && (
        <div className="card flex flex-wrap items-center gap-3 p-6">
          <p className="flex-1">{t("عندك منتجات رقمية عايز تبيعها؟")}</p>
          <Link href={siteHref("seller", "/seller/join")} className="btn-primary">{t("ابدأ البيع")}</Link>
        </div>
      )}
    </div>
  );
}
