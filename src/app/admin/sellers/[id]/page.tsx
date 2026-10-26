import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { sellerBalance } from "@/lib/ledger";
import { formatBps, formatEGP } from "@/lib/money";
import { SELLER_TIERS } from "@/lib/config";
import { ActionForm } from "@/components/action-form";
import { BalanceCards } from "@/components/ledger-view";
import { AuditList } from "../../audit-list";
import { sellerPayouts, sellerSales, sellerTerms } from "../../control-actions";

export const metadata = { title: "إدارة متجر" };

const PRODUCT_STATUS: Record<string, string> = {
  DRAFT: "مسودة",
  PENDING_REVIEW: "مستني مراجعة",
  ACTIVE: "نشط",
  REJECTED: "مرفوض",
  PAUSED: "متوقف مؤقتاً",
};

export default async function SellerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const seller = await db.sellerProfile.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, suspendedAt: true } },
      products: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          title: true,
          status: true,
          salesEnabled: true,
          price: true,
          soldCount: true,
        },
      },
    },
  });
  if (!seller) notFound();
  const [balance, sales, openDisputes, refunds, logs] = await Promise.all([
    sellerBalance(id),
    db.orderItem.aggregate({
      where: { sellerId: id, order: { status: "PAID" } },
      _sum: { total: true, commissionAmount: true },
      _count: true,
    }),
    db.dispute.count({ where: { status: "OPEN", orderItem: { sellerId: id } } }),
    db.dispute.count({
      where: { status: "RESOLVED_REFUND", orderItem: { sellerId: id } },
    }),
    db.auditLog.findMany({
      where: { targetId: { in: [id, seller.userId] } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  const tier = SELLER_TIERS[seller.type];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{seller.storeName}</h1>
        <span className="badge bg-slate-100 text-slate-700">{tier.label}</span>
        <span className="badge bg-slate-100 text-slate-700">
          التوثيق: {seller.kycStatus}
        </span>
        {seller.salesSuspendedAt && (
          <span className="badge bg-red-50 text-red-700">البيع موقوف</span>
        )}
        {seller.payoutsFrozenAt && (
          <span className="badge bg-amber-50 text-amber-800">السحب متجمّد</span>
        )}
        <div className="ms-auto flex gap-2">
          <Link className="btn-outline" href={`/stores/${seller.slug}`}>
            المتجر
          </Link>
          <Link className="btn-outline" href={`/admin/users/${seller.user.id}`}>
            حساب {seller.user.name}
          </Link>
          <Link className="btn-outline" href={`/admin/sellers/${id}/ledger`}>
            الحسابات والتسويات
          </Link>
        </div>
      </div>

      <BalanceCards balance={balance} />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="مبيعات" value={formatEGP(sales._sum.total ?? 0)} />
        <Stat
          label="عمولة المنصة"
          value={formatEGP(sales._sum.commissionAmount ?? 0)}
        />
        <Stat label="شكاوى مفتوحة" value={openDisputes} />
        <Stat label="شكاوى اتردّت" value={refunds} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">البيع</h2>
          {seller.salesSuspendedAt ? (
            <>
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                موقوف من {seller.salesSuspendedAt.toLocaleString("ar-EG")}:{" "}
                {seller.salesSuspendReason}
              </p>
              <ActionForm action={sellerSales} button="رجّع البيع">
                <input type="hidden" name="sellerId" value={id} />
                <input type="hidden" name="suspend" value="false" />
              </ActionForm>
            </>
          ) : (
            <ActionForm action={sellerSales} button="أوقف البيع">
              <input type="hidden" name="sellerId" value={id} />
              <input type="hidden" name="suspend" value="true" />
              <p className="text-sm text-slate-500">
                منتجاته هتختفي من الموقع ومحدش هيقدر يشتري لحد ما ترجّعه.
                الطلبات القديمة والشات شغالين عادي.
              </p>
              <label className="label">
                السبب (بيوصل للتاجر)
                <textarea className="input" name="reason" required maxLength={500} />
              </label>
            </ActionForm>
          )}
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-bold">السحب</h2>
          {seller.payoutsFrozenAt ? (
            <>
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                متجمّد من {seller.payoutsFrozenAt.toLocaleString("ar-EG")}:{" "}
                {seller.payoutsFrozenReason}
              </p>
              <ActionForm action={sellerPayouts} button="فك التجميد">
                <input type="hidden" name="sellerId" value={id} />
                <input type="hidden" name="freeze" value="false" />
              </ActionForm>
            </>
          ) : (
            <ActionForm action={sellerPayouts} button="جمّد السحب">
              <input type="hidden" name="sellerId" value={id} />
              <input type="hidden" name="freeze" value="true" />
              <p className="text-sm text-slate-500">
                التاجر مش هيقدر يطلب سحب جديد. الطلبات اللي اتبعتت قبل كده
                بتفضل في صفحة السحب.
              </p>
              <label className="label">
                السبب (بيوصل للتاجر)
                <textarea className="input" name="reason" required maxLength={500} />
              </label>
            </ActionForm>
          )}
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-bold">شروط خاصة</h2>
          <ActionForm action={sellerTerms} button="حفظ الشروط">
            <input type="hidden" name="sellerId" value={id} />
            <label className="label">
              العمولة % (فاضي = عمولة القسم)
              <input
                className="input"
                name="commission"
                dir="ltr"
                defaultValue={
                  seller.commissionBps === null
                    ? ""
                    : String(seller.commissionBps / 100)
                }
              />
            </label>
            <label className="label">
              أيام تعليق الرصيد (فاضي = {tier.holdDays} حسب نوع الحساب)
              <input
                className="input"
                name="holdDays"
                dir="ltr"
                defaultValue={seller.holdDays ?? ""}
              />
            </label>
            {seller.commissionBps !== null && (
              <p className="text-sm text-slate-500">
                العمولة الحالية: {formatBps(seller.commissionBps)}
              </p>
            )}
          </ActionForm>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 font-bold">المنتجات</h2>
        <div className="divide-y text-sm">
          {seller.products.map((p) => (
            <Link
              key={p.id}
              href={`/admin/products/${p.id}`}
              className="flex flex-wrap gap-3 py-2"
            >
              <span className="min-w-0 flex-1 font-semibold">{p.title}</span>
              <span>{PRODUCT_STATUS[p.status] ?? p.status}</span>
              {!p.salesEnabled && <span className="text-amber-700">البيع مقفول</span>}
              <span>{formatEGP(p.price)}</span>
              <span className="text-slate-500">
                اتباع {p.soldCount.toLocaleString("ar-EG")}
              </span>
            </Link>
          ))}
          {!seller.products.length && (
            <p className="text-slate-500">مفيش منتجات</p>
          )}
        </div>
      </section>

      <AuditList logs={logs} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">
        {typeof value === "number" ? value.toLocaleString("ar-EG") : value}
      </p>
    </div>
  );
}
