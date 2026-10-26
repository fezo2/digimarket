import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatEGP } from "@/lib/money";

export const metadata = { title: "لوحة الإدارة" };
export const dynamic = "force-dynamic";

const DAY = 86400000;

async function salesSince(since: Date) {
  const [orders, items] = await Promise.all([
    db.order.aggregate({
      where: { status: "PAID", paidAt: { gte: since } },
      _sum: { total: true },
      _count: true,
    }),
    db.orderItem.aggregate({
      where: { order: { status: "PAID", paidAt: { gte: since } } },
      _sum: { commissionAmount: true },
    }),
  ]);
  return {
    count: orders._count,
    total: orders._sum.total ?? 0,
    commission: items._sum.commissionAmount ?? 0,
  };
}

export default async function AdminHome() {
  await requireAdmin();
  const now = Date.now();
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
  const [
    pendingKyc,
    pendingProducts,
    manualPayments,
    payouts,
    disputes,
    flagged,
    reviewOrders,
    suspendedSellers,
    users,
    sellers,
    activeProducts,
    today,
    week,
    month,
    daily,
  ] = await Promise.all([
    db.kycSubmission.count({ where: { status: "PENDING" } }),
    db.product.count({ where: { status: "PENDING_REVIEW" } }),
    db.manualPayment.count({ where: { status: "SUBMITTED" } }),
    db.payout.count({ where: { status: "REQUESTED" } }),
    db.dispute.count({ where: { status: "OPEN" } }),
    db.message.count({
      where: { flagged: true, createdAt: { gte: new Date(now - 7 * DAY) } },
    }),
    db.order.count({ where: { status: "PAID", reviewReason: { not: null } } }),
    db.sellerProfile.count({ where: { salesSuspendedAt: { not: null } } }),
    db.user.count(),
    db.sellerProfile.count({ where: { kycStatus: "APPROVED" } }),
    db.product.count({ where: { status: "ACTIVE" } }),
    salesSince(startOfDay),
    salesSince(new Date(now - 7 * DAY)),
    salesSince(new Date(now - 30 * DAY)),
    db.$queryRaw<{ day: Date; total: bigint }[]>`
      SELECT date_trunc('day', "paidAt") AS day, SUM(total)::bigint AS total
      FROM "Order"
      WHERE status = 'PAID' AND "paidAt" >= ${new Date(now - 14 * DAY)}
      GROUP BY 1 ORDER BY 1`,
  ]);

  const queues = [
    ["طلبات توثيق", pendingKyc, "/admin/kyc"],
    ["منتجات مستنية مراجعة", pendingProducts, "/admin/products"],
    ["تحويلات يدوية", manualPayments, "/admin/payments"],
    ["طلبات سحب", payouts, "/admin/payouts"],
    ["شكاوى مفتوحة", disputes, "/admin/disputes"],
    ["طلبات مدفوعة محتاجة مراجعة", reviewOrders, "/admin/orders?review=1"],
    ["رسائل فيها وسائل تواصل (٧ أيام)", flagged, "/admin/messages"],
    ["متاجر البيع فيها موقوف", suspendedSellers, "/admin/sellers?filter=suspended"],
  ] as const;

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(startOfDay.getTime() - (13 - i) * DAY);
    const row = daily.find(
      (r) => new Date(r.day).toDateString() === d.toDateString(),
    );
    return { d, total: Number(row?.total ?? 0) };
  });
  const max = Math.max(1, ...days.map((d) => d.total));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">لوحة الإدارة</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">محتاج منك</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {queues.map(([label, n, href]) => (
            <Link
              key={href}
              href={href}
              className={`card p-4 ${n ? "border-brand-500" : ""}`}
            >
              <p className="text-sm text-slate-500">{label}</p>
              <p
                className={`mt-1 text-2xl font-bold ${n ? "text-brand-700" : ""}`}
              >
                {n.toLocaleString("ar-EG")}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">المبيعات</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["النهارده", today],
              ["آخر ٧ أيام", week],
              ["آخر ٣٠ يوم", month],
            ] as const
          ).map(([label, s]) => (
            <div key={label} className="card p-4">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold">{formatEGP(s.total)}</p>
              <p className="text-sm text-slate-500">
                {s.count.toLocaleString("ar-EG")} طلب · عمولة{" "}
                {formatEGP(s.commission)}
              </p>
            </div>
          ))}
        </div>
        <div className="card p-4">
          <p className="mb-3 text-sm text-slate-500">مبيعات آخر ١٤ يوم</p>
          <div className="flex h-40 items-end gap-1" dir="ltr">
            {days.map(({ d, total }) => (
              <div
                key={d.toISOString()}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                title={`${d.toLocaleDateString("ar-EG")}: ${formatEGP(total)}`}
              >
                <div
                  className="w-full rounded-t bg-brand-500"
                  style={{ height: `${Math.max(2, (total / max) * 100)}%` }}
                />
                <span className="text-[10px] text-slate-500">
                  {d.getDate()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["المستخدمين", users, "/admin/users"],
            ["تجار موثّقين", sellers, "/admin/sellers"],
            ["منتجات نشطة", activeProducts, "/admin/products"],
          ] as const
        ).map(([label, n, href]) => (
          <Link key={label} href={href} className="card p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold">
              {n.toLocaleString("ar-EG")}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
