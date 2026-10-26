import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { sellerBalance } from "@/lib/ledger";
import { formatEGP } from "@/lib/money";
import { SELLER_TIERS } from "@/lib/config";

export const metadata = { title: "لوحة التاجر" };

const KYC_BANNER = {
  NOT_SUBMITTED: { cls: "bg-amber-50 text-amber-800", text: "لازم توثّق هويتك قبل ما منتجاتك تظهر للناس.", cta: true },
  PENDING: { cls: "bg-blue-50 text-blue-800", text: "طلب التوثيق قيد المراجعة. هنبلّغك أول ما يخلص.", cta: false },
  REJECTED: { cls: "bg-red-50 text-red-800", text: "طلب التوثيق اترفض. شوف السبب وابعت الطلب تاني.", cta: true },
  APPROVED: null,
} as const;

export default async function SellerDashboard() {
  const { seller } = await requireSeller();
  const tier = SELLER_TIERS[seller.type];
  const since = new Date(Date.now() - 29 * 86400000);
  since.setHours(0, 0, 0, 0);
  const [balance, productCount, soldItems, news, daily, refunds, top] = await Promise.all([
    sellerBalance(seller.id),
    db.product.count({ where: { sellerId: seller.id } }),
    db.orderItem.aggregate({ where: { sellerId: seller.id, order: { status: "PAID" } }, _sum: { quantity: true } }),
    db.announcement.findMany({ where: { active: true }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.$queryRaw<{ day: Date; net: bigint; count: bigint }[]>`
      SELECT date_trunc('day', o."paidAt") AS day, SUM(i."sellerNet")::bigint AS net, COUNT(*)::bigint AS count
      FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
      WHERE i."sellerId" = ${seller.id} AND o.status = 'PAID' AND o."paidAt" >= ${since}
      GROUP BY 1 ORDER BY 1`,
    db.dispute.count({ where: { status: "RESOLVED_REFUND", orderItem: { sellerId: seller.id } } }),
    db.orderItem.groupBy({
      by: ["productId", "title"],
      where: { sellerId: seller.id, order: { status: "PAID", paidAt: { gte: since } } },
      _sum: { quantity: true, sellerNet: true },
      orderBy: { _sum: { sellerNet: "desc" } },
      take: 5,
    }),
  ]);
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86400000);
    const row = daily.find((r) => new Date(r.day).toDateString() === d.toDateString());
    return { d, net: Number(row?.net ?? 0), count: Number(row?.count ?? 0) };
  });
  const max = Math.max(1, ...days.map((d) => d.net));
  const monthNet = days.reduce((a, d) => a + d.net, 0);
  const reviews = seller.positiveReviews + seller.negativeReviews;
  const banner = KYC_BANNER[seller.kycStatus];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{seller.storeName}</h1>
        <span className="badge bg-slate-100 text-slate-700">{tier.label}</span>
        {seller.kycStatus === "APPROVED" && <span className="badge bg-emerald-50 text-emerald-700">✓ {tier.badge}</span>}
        {seller.kycStatus === "APPROVED" && (
          <Link href={`/stores/${seller.slug}`} className="ms-auto text-sm font-semibold text-brand-600">شوف متجرك ←</Link>
        )}
      </div>

      {banner && (
        <div className={`flex flex-wrap items-center gap-3 rounded-2xl p-4 text-sm ${banner.cls}`}>
          <p className="flex-1">{banner.text}</p>
          {banner.cta && <Link href="/seller/kyc" className="btn-primary">وثّق حسابك</Link>}
        </div>
      )}

      {seller.salesSuspendedAt && (
        <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          <p className="font-bold">الإدارة وقفت البيع في متجرك مؤقتاً</p>
          <p>السبب: {seller.salesSuspendReason}</p>
          <p>منتجاتك مش ظاهرة للمشترين لحد ما المشكلة تتحل. ردّ على العميل في الطلب أو كلّم الدعم.</p>
        </div>
      )}
      {seller.payoutsFrozenAt && (
        <p role="alert" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">الإدارة جمّدت السحب من متجرك: {seller.payoutsFrozenReason}</p>
      )}

      {news.map((n) => (
        <div key={n.id} className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-bold">📢 {n.title}</p>
          <p className="whitespace-pre-wrap">{n.body}</p>
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="قابل للسحب" value={formatEGP(balance.available)} accent />
        <Stat label="معلّق" value={formatEGP(balance.held)} hint={`بيتاح بعد ${seller.holdDays ?? tier.holdDays} أيام من البيع`} />
        <Stat label="المنتجات" value={productCount.toLocaleString("ar-EG")} hint={`الحد: ${tier.maxActiveProducts.toLocaleString("ar-EG")}`} />
        <Stat label="قطع مباعة" value={(soldItems._sum.quantity ?? 0).toLocaleString("ar-EG")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="صافي آخر ٣٠ يوم" value={formatEGP(monthNet)} />
        <Stat label="تقييمات إيجابية" value={`${seller.positiveReviews.toLocaleString("ar-EG")} 👍`} />
        <Stat label="تقييمات سلبية" value={`${seller.negativeReviews.toLocaleString("ar-EG")} 👎`} hint={reviews ? `نسبة الرضا ${Math.round((seller.positiveReviews / reviews) * 100).toLocaleString("ar-EG")}٪` : undefined} />
        <Stat label="شكاوى اترد فلوسها" value={refunds.toLocaleString("ar-EG")} />
      </div>

      <div className="card p-4">
        <p className="mb-3 text-sm text-slate-500">صافي المبيعات آخر ٣٠ يوم</p>
        <div className="flex h-40 items-end gap-0.5" dir="ltr">
          {days.map(({ d, net, count }) => (
            <div key={d.toISOString()} className="flex flex-1 flex-col items-center gap-1" title={`${d.toLocaleDateString("ar-EG")}: ${formatEGP(net)} · ${count} طلب`}>
              <div className="w-full rounded-t bg-brand-500" style={{ height: `${Math.max(2, (net / max) * 100)}%` }} />
              <span className="text-[9px] text-slate-500">{d.getDate()}</span>
            </div>
          ))}
        </div>
      </div>

      {top.length > 0 && (
        <div className="card p-4">
          <p className="mb-2 font-bold">الأكثر مبيعاً آخر ٣٠ يوم</p>
          <div className="divide-y text-sm">
            {top.map((t) => (
              <div key={t.productId} className="flex gap-3 py-2">
                <span className="flex-1">{t.title}</span>
                <span>{(t._sum.quantity ?? 0).toLocaleString("ar-EG")} قطعة</span>
                <span className="font-semibold">{formatEGP(t._sum.sellerNet ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3"><Link className="btn-primary" href="/seller/products">إدارة المنتجات</Link><Link className="btn-outline" href="/seller/sales">المبيعات والأرباح</Link></div>
    </div>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent ? "text-brand-700" : ""}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
