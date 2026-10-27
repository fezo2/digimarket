import { i18n } from "@/lib/prefs";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function generateMetadata() {
  return { title: (await i18n()).t("المستخدمين") };
}

const ROLES = { BUYER: "مشتري", SELLER: "تاجر", ADMIN: "أدمن" } as const;

export default async function Users({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { t, num } = await i18n();
  await requireAdmin();
  const { q = "", filter = "" } = await searchParams;
  const term = q.trim().slice(0, 100);
  const where: Prisma.UserWhereInput = {
    ...(term
      ? {
          OR: [
            { email: { contains: term, mode: "insensitive" } },
            { name: { contains: term, mode: "insensitive" } },
            { phone: { contains: term } },
            { seller: { storeName: { contains: term, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(filter === "suspended" ? { suspendedAt: { not: null } } : {}),
    ...(filter === "sellers" ? { seller: { isNot: null } } : {}),
    ...(filter === "admins" ? { role: "ADMIN" } : {}),
  };
  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      suspendedAt: true,
      seller: { select: { storeName: true, salesSuspendedAt: true } },
      _count: { select: { orders: true, disputes: true } },
    },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t("المستخدمين")}</h1>
      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={term}
          className="input max-w-sm"
          placeholder={t("ابحث بالإيميل أو الاسم أو الموبايل أو اسم المتجر")}
        />
        <select name="filter" defaultValue={filter} className="input w-auto">
          <option value="">{t("الكل")}</option>
          <option value="sellers">{t("التجار")}</option>
          <option value="suspended">{t("الموقوفين")}</option>
          <option value="admins">{t("الأدمن")}</option>
        </select>
        <button className="btn-primary">{t("بحث")}</button>
      </form>
      <div className="card divide-y">
        {users.map((u) => (
          <Link
            key={u.id}
            href={`/admin/users/${u.id}`}
            className="flex flex-wrap items-center gap-3 p-4 hover:bg-slate-50"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{u.name}</p>
              <p className="text-sm text-slate-500" dir="ltr">
                {u.email}
              </p>
            </div>
            <span className="badge bg-slate-100 text-slate-700">
              {t(ROLES[u.role])}
            </span>
            {u.seller && (
              <span className="badge bg-blue-50 text-blue-700">
                {u.seller.storeName}
              </span>
            )}
            {u.suspendedAt && (
              <span className="badge bg-red-50 text-red-700">{t("موقوف")}</span>
            )}
            {u.seller?.salesSuspendedAt && (
              <span className="badge bg-amber-50 text-amber-800">
                {t("البيع موقوف")}
              </span>
            )}
            <span className="text-sm text-slate-500">
              {num(u._count.orders)}{t(" طلب ·")}{" "}
              {num(u._count.disputes)}{t(" شكوى")}
            </span>
          </Link>
        ))}
        {!users.length && <p className="p-4 text-slate-500">{t("مفيش نتايج")}</p>}
      </div>
    </div>
  );
}
