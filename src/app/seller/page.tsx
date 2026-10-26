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
  const [balance, productCount, soldItems, news] = await Promise.all([
    sellerBalance(seller.id),
    db.product.count({ where: { sellerId: seller.id } }),
    db.orderItem.aggregate({ where: { sellerId: seller.id, order: { status: "PAID" } }, _sum: { quantity: true } }),
    db.announcement.findMany({ where: { active: true }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);
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
