import { i18n } from "@/lib/prefs";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { userLogout, userProfile, userSuspension } from "../../control-actions";
import { AuditList } from "../../audit-list";

export async function generateMetadata() {
  return { title: (await i18n()).t("حساب مستخدم") };
}

const ORDER_STATUS = {
  PENDING_PAYMENT: "مستني الدفع",
  PAID: "مدفوع",
  CANCELLED: "ملغي",
  REFUNDED: "مسترد",
  PARTIALLY_REFUNDED: "مسترد جزئي",
} as const;

export default async function UserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t, money, date, day } = await i18n();
  await requireAdmin();
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    include: {
      seller: { select: { id: true, storeName: true, kycStatus: true } },
      orders: { orderBy: { createdAt: "desc" }, take: 20 },
      disputes: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { orderItem: { select: { title: true, orderId: true } } },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { product: { select: { title: true } } },
      },
    },
  });
  if (!user) notFound();
  const [spent, logs] = await Promise.all([
    db.order.aggregate({
      where: { buyerId: id, status: "PAID" },
      _sum: { total: true },
    }),
    db.auditLog.findMany({
      where: { targetId: { in: [id, user.seller?.id ?? id] } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{user.name}</h1>
        <span className="text-slate-500" dir="ltr">
          {user.email}
        </span>
        {user.suspendedAt && (
          <span className="badge bg-red-50 text-red-700">{t("موقوف")}</span>
        )}
        {user.seller && (
          <Link
            className="btn-outline ms-auto"
            href={`/admin/sellers/${user.seller.id}`}
          >
            {t("إدارة متجر ")}{user.seller.storeName} ←
          </Link>
        )}
      </div>
      <p className="text-sm text-slate-500">
        {t("مسجّل من ")}{day(user.createdAt)}{t(" · صرف")}{" "}
        {money(spent._sum.total ?? 0)}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">{t("البيانات وملاحظة الإدارة")}</h2>
          <ActionForm action={userProfile} button={t("حفظ")}>
            <input type="hidden" name="userId" value={user.id} />
            <label className="label">
              {t("الاسم")}
              <input
                className="input"
                name="name"
                defaultValue={user.name}
                required
              />
            </label>
            <label className="label">
              {t("الموبايل")}
              <input
                className="input"
                name="phone"
                defaultValue={user.phone ?? ""}
                dir="ltr"
              />
            </label>
            <label className="label">
              {t("ملاحظة داخلية (مش بتظهر للمستخدم)")}
              <textarea
                className="input"
                name="adminNote"
                defaultValue={user.adminNote ?? ""}
                maxLength={2000}
              />
            </label>
          </ActionForm>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-bold">{t("التحكم في الحساب")}</h2>
          {user.role === "ADMIN" ? (
            <p className="text-sm text-slate-500">{t("ده حساب أدمن.")}</p>
          ) : user.suspendedAt ? (
            <>
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {t("موقوف من ")}{date(user.suspendedAt)}:{" "}
                {user.suspendReason}
              </p>
              <ActionForm action={userSuspension} button={t("رجّع الحساب")}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="suspend" value="false" />
              </ActionForm>
            </>
          ) : (
            <ActionForm action={userSuspension} button={t("إيقاف الحساب")}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="suspend" value="true" />
              <label className="label">
                {t("سبب الإيقاف (بيظهر له لما يحاول يدخل)")}
                <textarea
                  className="input"
                  name="reason"
                  required
                  maxLength={500}
                />
              </label>
            </ActionForm>
          )}
          <ActionForm action={userLogout} button={t("خروج من كل الأجهزة")}>
            <input type="hidden" name="userId" value={user.id} />
          </ActionForm>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 font-bold">{t("آخر الطلبات")}</h2>
        <div className="divide-y text-sm">
          {user.orders.map((o) => (
            <Link
              key={o.id}
              href={`/admin/orders/${o.id}`}
              className="flex gap-3 py-2"
            >
              <span>#{o.number}</span>
              <span>{t(ORDER_STATUS[o.status])}</span>
              <span>{money(o.total)}</span>
              <span className="ms-auto text-slate-500">
                {day(o.createdAt)}
              </span>
            </Link>
          ))}
          {!user.orders.length && <p className="text-slate-500">{t("مفيش طلبات")}</p>}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold">{t("الشكاوى")}</h2>
          <div className="divide-y text-sm">
            {user.disputes.map((d) => (
              <Link
                key={d.id}
                href={`/admin/orders/${d.orderItem.orderId}`}
                className="block py-2"
              >
                <p className="font-semibold">
                  {d.orderItem.title} · {d.status}
                </p>
                <p className="line-clamp-2 text-slate-600">{d.reason}</p>
              </Link>
            ))}
            {!user.disputes.length && (
              <p className="text-slate-500">{t("مفيش شكاوى")}</p>
            )}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">{t("التقييمات اللي كتبها")}</h2>
          <div className="divide-y text-sm">
            {user.reviews.map((r) => (
              <div key={r.id} className="py-2">
                <p className="font-semibold">
                  {r.positive ? "👍" : "👎"} {r.product.title}
                  {r.hiddenAt && (
                    <span className="badge ms-2 bg-slate-100">{t("مخفي")}</span>
                  )}
                </p>
                <p className="text-slate-600">{r.comment}</p>
              </div>
            ))}
            {!user.reviews.length && (
              <p className="text-slate-500">{t("مفيش تقييمات")}</p>
            )}
          </div>
        </section>
      </div>

      <AuditList logs={logs} />
    </div>
  );
}
