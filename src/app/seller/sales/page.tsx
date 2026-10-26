import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { sellerBalance } from "@/lib/ledger";
import { formatEGP, formatBps } from "@/lib/money";

export default async function SellerSales({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const query = await searchParams;
  const { seller } = await requireSeller();
  const [balance, items, ledger] = await Promise.all([
    sellerBalance(seller.id),
    db.orderItem.findMany({
      where: {
        sellerId: seller.id,
        ...(query.order ? { orderId: query.order } : {}),
        order: { status: { in: ["PAID", "REFUNDED"] } },
      },
      orderBy: { order: { paidAt: "desc" } },
      select: {
        id: true,
        title: true,
        quantity: true,
        total: true,
        commissionBps: true,
        commissionAmount: true,
        sellerNet: true,
        deliveredAt: true,
        order: { select: { id: true, number: true, paidAt: true } },
      },
    }),
    db.ledgerEntry.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
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
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {[
                "التاريخ",
                "الطلب",
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
                <td>{i.title}</td>
                <td>{i.quantity}</td>
                <td>{formatEGP(i.total)}</td>
                <td>
                  {formatEGP(i.commissionAmount)} ({formatBps(i.commissionBps)})
                </td>
                <td>{formatEGP(i.sellerNet)}</td>
                <td>{i.deliveredAt ? "اتسلّم" : "مراجعة الإدارة"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <p className="p-6">لسه مفيش مبيعات.</p>}
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
