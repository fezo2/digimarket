import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { sellerBalance } from "@/lib/ledger";
import { formatBps } from "@/lib/money";
import { salesWhere } from "@/lib/seller-tools";

export default async function SellerSales({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; q?: string; from?: string; to?: string }>;
}) {
  const { t, money, date } = await i18n();
  const query = await searchParams;
  const { seller } = await requireSeller();
  const [balance, items, ledger] = await Promise.all([
    sellerBalance(seller.id),
    db.orderItem.findMany({
      where: {
        ...salesWhere(seller.id, query),
        ...(query.order ? { orderId: query.order } : {}),
      },
      orderBy: { order: { paidAt: "desc" } },
      take: 200,
      select: {
        id: true,
        title: true,
        quantity: true,
        total: true,
        commissionBps: true,
        commissionAmount: true,
        sellerNet: true,
        deliveredAt: true,
        refundedAmount: true,
        order: {
          select: {
            id: true,
            number: true,
            paidAt: true,
            buyer: { select: { email: true } },
          },
        },
      },
    }),
    db.ledgerEntry.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        createdAt: true,
        type: true,
        amount: true,
        availableAt: true,
      },
    }),
  ]);
  const types = {
    SALE: t("بيع"),
    REFUND: t("استرداد"),
    PAYOUT: t("سحب"),
    ADJUSTMENT: t("تسوية"),
  };
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{t("المبيعات والأرباح")}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          {t("قابل للسحب: ")}{money(balance.available)}
        </div>
        <div className="card p-5">{t("معلّق: ")}{money(balance.held)}</div>
      </div>
      <form className="card flex flex-wrap items-end gap-3 p-4">
        <label className="label min-w-48 flex-1">
          {t("بحث")}
          <input
            className="input"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder={t("رقم الطلب أو إيميل المشتري أو المنتج أو الكود")}
          />
        </label>
        <label className="label">
          {t("من")}
          <input className="input" type="date" name="from" defaultValue={query.from ?? ""} />
        </label>
        <label className="label">
          {t("إلى")}
          <input className="input" type="date" name="to" defaultValue={query.to ?? ""} />
        </label>
        <button className="btn-primary">{t("بحث")}</button>
        <a
          className="btn-outline"
          href={`/seller/sales/export?${new URLSearchParams({
            q: query.q ?? "",
            from: query.from ?? "",
            to: query.to ?? "",
          })}`}
        >
          {t("تحميل Excel (CSV)")}
        </a>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {[
                t("التاريخ"),
                t("الطلب"),
                t("المشتري"),
                t("المنتج"),
                t("الكمية"),
                t("الإجمالي"),
                t("العمولة"),
                t("الصافي"),
                t("التسليم"),
              ].map((h) => (
                <th key={h} className="p-3 text-start">
                  {t(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="p-3">
                  {i.order.paidAt && date(i.order.paidAt)}
                </td>
                <td>
                  <Link
                    className="underline"
                    href={`/seller/sales/${i.order.id}`}
                  >
                    #{i.order.number}
                  </Link>
                </td>
                <td dir="ltr" className="text-start">
                  {i.order.buyer.email}
                </td>
                <td>{i.title}</td>
                <td>{i.quantity}</td>
                <td>{money(i.total)}</td>
                <td>
                  {money(i.commissionAmount)} ({formatBps(i.commissionBps)})
                </td>
                <td>{money(i.sellerNet)}</td>
                <td>
                  {i.refundedAmount > 0
                    ? t("مسترد {amount}", { amount: money(i.refundedAmount) })
                    : i.deliveredAt
                      ? t("اتسلّم")
                      : t("مراجعة الإدارة")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <p className="p-6">
            {query.q || query.from || query.to ? t("مفيش نتايج") : t("لسه مفيش مبيعات.")}
          </p>
        )}
      </div>
      <h2 className="text-xl font-bold">{t("حركات الرصيد")}</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {[t("التاريخ"), t("النوع"), t("المبلغ"), t("متاح من")].map((h) => (
                <th key={h} className="p-3 text-start">
                  {t(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ledger.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-3">{date(e.createdAt)}</td>
                <td>{types[e.type]}</td>
                <td>{money(e.amount)}</td>
                <td>{date(e.availableAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
