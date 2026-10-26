import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { releaseExpiredOrders } from "@/lib/orders";
import { orderStatusLabels } from "@/lib/order-snapshot";
import { formatEGP } from "@/lib/money";

export default async function AdminOrders() {
  await requireAdmin();
  await releaseExpiredOrders();
  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      paymentProvider: true,
      paymentRef: true,
      buyer: { select: { name: true, email: true } },
      items: { select: { deliveredAt: true } },
    },
  });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">آخر 100 طلب</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {[
                "الطلب",
                "الحالة",
                "المشتري",
                "المبلغ",
                "البوابة",
                "مرجع الدفع",
              ].map((t) => (
                <th key={t} className="p-3 text-start">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const review =
                o.status === "PAID" &&
                (!o.items.length || o.items.some((i) => !i.deliveredAt));
              return (
                <tr
                  key={o.id}
                  className={`border-t ${review ? "bg-red-50 text-red-800" : ""}`}
                >
                  <td className="p-3">#{o.number}</td>
                  <td>
                    {orderStatusLabels[o.status]}
                    {review && (
                      <strong className="block">
                        مدفوع من غير تسليم — محتاج مراجعة
                      </strong>
                    )}
                  </td>
                  <td>
                    {o.buyer.name}
                    <p dir="ltr">{o.buyer.email}</p>
                  </td>
                  <td>{formatEGP(o.total)}</td>
                  <td>{o.paymentProvider ?? "—"}</td>
                  <td>
                    {o.paymentRef?.startsWith("intent:") ||
                    o.paymentRef === "creating"
                      ? "بانتظار نتيجة الدفع"
                      : (o.paymentRef ?? "—")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
