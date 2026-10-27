import { i18n } from "@/lib/prefs";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { sellerBalance } from "@/lib/ledger";
import { formatBps } from "@/lib/money";
import { SELLER_TIERS } from "@/lib/config";
import { ActionForm } from "@/components/action-form";
import { BalanceCards } from "@/components/ledger-view";
import { AuditList } from "../../audit-list";
import { sellerPayouts, sellerSales, sellerTerms } from "../../control-actions";

export async function generateMetadata() {
  return { title: (await i18n()).t("إدارة متجر") };
}

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
  const { t, money, num, date } = await i18n();
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
          {t("التوثيق: ")}{seller.kycStatus}
        </span>
        {seller.salesSuspendedAt && (
          <span className="badge bg-red-50 text-red-700">{t("البيع موقوف")}</span>
        )}
        {seller.payoutsFrozenAt && (
          <span className="badge bg-amber-50 text-amber-800">{t("السحب متجمّد")}</span>
        )}
        <div className="ms-auto flex gap-2">
          <Link className="btn-outline" href={`/stores/${seller.slug}`}>
            {t("المتجر")}
          </Link>
          <Link className="btn-outline" href={`/admin/users/${seller.user.id}`}>
            {t("حساب ")}{seller.user.name}
          </Link>
          <Link className="btn-outline" href={`/admin/sellers/${id}/ledger`}>
            {t("الحسابات والتسويات")}
          </Link>
        </div>
      </div>

      <BalanceCards balance={balance} />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={t("مبيعات")} value={money(sales._sum.total ?? 0)} />
        <Stat
          label={t("عمولة المنصة")}
          value={money(sales._sum.commissionAmount ?? 0)}
        />
        <Stat label={t("شكاوى مفتوحة")} value={openDisputes} />
        <Stat label={t("شكاوى اتردّت")} value={refunds} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">{t("البيع")}</h2>
          {seller.salesSuspendedAt ? (
            <>
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {t("موقوف من ")}{date(seller.salesSuspendedAt)}:{" "}
                {seller.salesSuspendReason}
              </p>
              <ActionForm action={sellerSales} button={t("رجّع البيع")}>
                <input type="hidden" name="sellerId" value={id} />
                <input type="hidden" name="suspend" value="false" />
              </ActionForm>
            </>
          ) : (
            <ActionForm action={sellerSales} button={t("أوقف البيع")}>
              <input type="hidden" name="sellerId" value={id} />
              <input type="hidden" name="suspend" value="true" />
              <p className="text-sm text-slate-500">
                {t("منتجاته هتختفي من الموقع ومحدش هيقدر يشتري لحد ما ترجّعه. الطلبات القديمة والشات شغالين عادي.")}
              </p>
              <label className="label">
                {t("السبب (بيوصل للتاجر)")}
                <textarea className="input" name="reason" required maxLength={500} />
              </label>
            </ActionForm>
          )}
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-bold">{t("السحب")}</h2>
          {seller.payoutsFrozenAt ? (
            <>
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                {t("متجمّد من ")}{date(seller.payoutsFrozenAt)}:{" "}
                {seller.payoutsFrozenReason}
              </p>
              <ActionForm action={sellerPayouts} button={t("فك التجميد")}>
                <input type="hidden" name="sellerId" value={id} />
                <input type="hidden" name="freeze" value="false" />
              </ActionForm>
            </>
          ) : (
            <ActionForm action={sellerPayouts} button={t("جمّد السحب")}>
              <input type="hidden" name="sellerId" value={id} />
              <input type="hidden" name="freeze" value="true" />
              <p className="text-sm text-slate-500">
                {t("التاجر مش هيقدر يطلب سحب جديد. الطلبات اللي اتبعتت قبل كده بتفضل في صفحة السحب.")}
              </p>
              <label className="label">
                {t("السبب (بيوصل للتاجر)")}
                <textarea className="input" name="reason" required maxLength={500} />
              </label>
            </ActionForm>
          )}
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-bold">{t("شروط خاصة")}</h2>
          <ActionForm action={sellerTerms} button={t("حفظ الشروط")}>
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
              أيام تعليق الرصيد (فاضي = {tier.holdDays}{t(" حسب نوع الحساب)")}
              <input
                className="input"
                name="holdDays"
                dir="ltr"
                defaultValue={seller.holdDays ?? ""}
              />
            </label>
            {seller.commissionBps !== null && (
              <p className="text-sm text-slate-500">
                {t("العمولة الحالية: ")}{formatBps(seller.commissionBps)}
              </p>
            )}
          </ActionForm>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 font-bold">{t("المنتجات")}</h2>
        <div className="divide-y text-sm">
          {seller.products.map((p) => (
            <Link
              key={p.id}
              href={`/admin/products/${p.id}`}
              className="flex flex-wrap gap-3 py-2"
            >
              <span className="min-w-0 flex-1 font-semibold">{p.title}</span>
              <span>{t(PRODUCT_STATUS[p.status] ?? p.status)}</span>
              {!p.salesEnabled && <span className="text-amber-700">{t("البيع مقفول")}</span>}
              <span>{money(p.price)}</span>
              <span className="text-slate-500">
                {t("اتباع ")}{num(p.soldCount)}
              </span>
            </Link>
          ))}
          {!seller.products.length && (
            <p className="text-slate-500">{t("مفيش منتجات")}</p>
          )}
        </div>
      </section>

      <AuditList logs={logs} />
    </div>
  );
}

async function Stat({ label, value }: { label: string; value: string | number }) {
  const { num } = await i18n();
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">
        {typeof value === "number" ? num(value) : value}
      </p>
    </div>
  );
}
