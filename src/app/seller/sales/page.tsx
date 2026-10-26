import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { sellerBalance } from "@/lib/ledger";
import { formatEGP, formatBps } from "@/lib/money";
import { salesWhere } from "@/lib/seller-tools";

export default async function SellerSales({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; q?: string; from?: string; to?: string }>;
}) {
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
    SALE: "بيع",
    REFUND: "استرداد",
    PAYOUT: "سحب",
    ADJUSTMENT: "تسوية",
  };
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">المبيعات والأرباح</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          قابل للسحب: {formatEGP(balance.available)}
        </div>
        <div className="card p-5">معلّق: {formatEGP(balance.held)}</div>
      </div>
      <form className="card flex flex-wrap items-end gap-3 p-4">
        <label className="label min-w-48 flex-1">
          بحث
          <input
            className="input"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="رقم الطلب أو إيميل المشتري أو المنتج أو الكود"
          />
        </label>
        <label className="label">
          من
          <input className="input" type="date" name="from" defaultValue={query.from ?? ""} />
        </label>
        <label className="label">
          إلى
          <input className="input" type="date" name="to" defaultValue={query.to ?? ""} />
        </label>
        <button className="btn-primary">بحث</button>
        <a
          className="btn-outline"
          href={`/seller/sales/export?${new URLSearchParams({
            q: query.q ?? "",
            from: query.from ?? "",
            to: query.to ?? "",
          })}`}
        >
          تحميل Excel (CSV)
        </a>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {[
                "التاريخ",
                "الطلب",
                "المشتري",
                "المنتج",
                "الكمية",
                "الإجمالي",
                "العمولة",
                "الصافي",
                "التسليم",
              ].map((t) => (
                <th key={t} className="p-3 text-start">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="p-3">
                  {i.order.paidAt?.toLocaleString("ar-EG")}
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
                <td>{formatEGP(i.total)}</td>
                <td>
                  {formatEGP(i.commissionAmount)} ({formatBps(i.commissionBps)})
                </td>
                <td>{formatEGP(i.sellerNet)}</td>
                <td>
                  {i.refundedAmount > 0
                    ? `مسترد ${formatEGP(i.refundedAmount)}`
                    : i.deliveredAt
                      ? "اتسلّم"
                      : "مراجعة الإدارة"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <p className="p-6">
            {query.q || query.from || query.to ? "مفيش نتايج" : "لسه مفيش مبيعات."}
          </p>
        )}
      </div>
      <h2 className="text-xl font-bold">حركات الرصيد</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {["التاريخ", "النوع", "المبلغ", "متاح من"].map((t) => (
                <th key={t} className="p-3 text-start">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ledger.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-3">{e.createdAt.toLocaleString("ar-EG")}</td>
                <td>{types[e.type]}</td>
                <td>{formatEGP(e.amount)}</td>
                <td>{e.availableAt.toLocaleString("ar-EG")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
