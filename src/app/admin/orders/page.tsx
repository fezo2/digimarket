import { unreadCounts } from "@/lib/chat";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { retryDelivery, recordRefund } from "./actions";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { releaseExpiredOrders } from "@/lib/orders";
import { orderStatusLabels } from "@/lib/order-snapshot";
import { formatEGP } from "@/lib/money";

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ review?: string; order?: string }>;
}) {
  const query = await searchParams;
  const actor = await requireAdmin();
  const unread = await unreadCounts(actor.id, true);
  await releaseExpiredOrders();
  const orders = await db.order.findMany({
    where: {
      ...(query.order ? { id: query.order } : {}),
      ...(query.review === "1"
        ? { status: "PAID", items: { some: { deliveredAt: null } } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      paidAmount: true,
      reviewReason: true,
      paymentProvider: true,
      paymentRef: true,
      buyer: { select: { name: true, email: true } },
      items: { select: { deliveredAt: true } },
    },
  });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">آخر 100 طلب</h1>
      <nav className="flex gap-3">
        <Link className="btn-outline" href="/admin/orders">
          كل الطلبات
        </Link>
        <Link className="btn-outline" href="/admin/orders?review=1">
          محتاج مراجعة
        </Link>
      </nav>
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
                "الإجراءات",
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
                  <td className="p-3">
                    <Link className="underline" href={`/admin/orders/${o.id}`}>
                      #{o.number}
                    </Link>
                    {Boolean(unread.get(o.id)) && (
                      <span className="badge">{unread.get(o.id)}</span>
                    )}
                  </td>
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
                  <td>
                    {formatEGP(o.total)}
                    <p>
                      المدفوع:{" "}
                      {o.paidAmount === null
                        ? "غير مسجل"
                        : formatEGP(o.paidAmount)}
                    </p>
                  </td>
                  <td>{o.paymentProvider ?? "—"}</td>
                  <td>
                    {o.paymentRef?.startsWith("intent:") ||
                    o.paymentRef === "creating"
                      ? "بانتظار نتيجة الدفع"
                      : (o.paymentRef ?? "—")}
                  </td>
                  <td className="min-w-64 space-y-4 p-3">
                    {review && (
                      <>
                        <p>{o.reviewReason ?? "سبب المراجعة غير مسجل"}</p>
                        <ActionForm
                          action={retryDelivery}
                          button="إعادة التسليم"
                        >
                          <input type="hidden" name="id" value={o.id} />
                        </ActionForm>
                      </>
                    )}
                    {o.status === "PAID" && (
                      <ActionForm
                        action={recordRefund}
                        button="تم رد الفلوس للمشتري"
                      >
                        <input type="hidden" name="id" value={o.id} />
                        <p>
                          سجّل بس بعد ما ترجع الفلوس فعليًا من بوابة الدفع أو
                          التحويل.
                        </p>
                        <label className="label">
                          ملاحظة الاسترداد
                          <textarea
                            className="input"
                            name="note"
                            required
                            maxLength={1000}
                          />
                        </label>
                      </ActionForm>
                    )}
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
