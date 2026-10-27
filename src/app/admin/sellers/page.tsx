import { i18n } from "@/lib/prefs";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function generateMetadata() {
  return { title: (await i18n()).t("التجار") };
}

export default async function Sellers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { t, num } = await i18n();
  await requireAdmin();
  const { q = "", filter = "" } = await searchParams;
  const term = q.trim().slice(0, 100);
  const where: Prisma.SellerProfileWhereInput = {
    ...(term
      ? {
          OR: [
            { storeName: { contains: term, mode: "insensitive" } },
            { slug: { contains: term, mode: "insensitive" } },
            { user: { email: { contains: term, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(filter === "suspended" ? { salesSuspendedAt: { not: null } } : {}),
    ...(filter === "frozen" ? { payoutsFrozenAt: { not: null } } : {}),
    ...(filter === "custom"
      ? { OR: [{ commissionBps: { not: null } }, { holdDays: { not: null } }] }
      : {}),
  };
  const sellers = await db.sellerProfile.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      storeName: true,
      kycStatus: true,
      salesSuspendedAt: true,
      payoutsFrozenAt: true,
      commissionBps: true,
      holdDays: true,
      user: { select: { email: true, suspendedAt: true } },
      _count: { select: { products: true } },
      orderItems: {
        select: {
          _count: { select: { disputes: { where: { status: "RESOLVED_REFUND" } } } },
        },
      },
    },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t("التجار")}</h1>
      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={term}
          className="input max-w-sm"
          placeholder={t("ابحث باسم المتجر أو الإيميل")}
        />
        <select name="filter" defaultValue={filter} className="input w-auto">
          <option value="">{t("الكل")}</option>
          <option value="suspended">{t("البيع موقوف")}</option>
          <option value="frozen">{t("السحب متجمّد")}</option>
          <option value="custom">{t("شروط خاصة")}</option>
        </select>
        <button className="btn-primary">{t("بحث")}</button>
      </form>
      <div className="card divide-y">
        {sellers.map((s) => (
          <Link
            key={s.id}
            href={`/admin/sellers/${s.id}`}
            className="flex flex-wrap items-center gap-3 p-4 hover:bg-slate-50"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{s.storeName}</p>
              <p className="text-sm text-slate-500" dir="ltr">
                {s.user.email}
              </p>
            </div>
            <span className="badge bg-slate-100 text-slate-700">{s.kycStatus}</span>
            {s.user.suspendedAt && (
              <span className="badge bg-red-50 text-red-700">{t("الحساب موقوف")}</span>
            )}
            {s.salesSuspendedAt && (
              <span className="badge bg-red-50 text-red-700">{t("البيع موقوف")}</span>
            )}
            {s.payoutsFrozenAt && (
              <span className="badge bg-amber-50 text-amber-800">{t("السحب متجمّد")}</span>
            )}
            {(s.commissionBps !== null || s.holdDays !== null) && (
              <span className="badge bg-blue-50 text-blue-700">{t("شروط خاصة")}</span>
            )}
            <span className="text-sm text-slate-500">
              {num(s._count.products)}{t(" منتج · شكاوى اتردّت")}{" "}
              {num(
                s.orderItems.reduce((sum, i) => sum + i._count.disputes, 0),
              )}
            </span>
          </Link>
        ))}
        {!sellers.length && <p className="p-4 text-slate-500">{t("مفيش نتايج")}</p>}
      </div>
    </div>
  );
}
