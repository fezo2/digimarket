import { i18n } from "@/lib/prefs";
import { unreadCounts } from "@/lib/chat";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { confirmRefundPaid, retryDelivery, recordRefund } from "./actions";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { releaseExpiredOrders } from "@/lib/orders";
import { orderStatusLabels } from "@/lib/order-snapshot";

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ review?: string; order?: string; repay?: string }>;
}) {
  const { t, money } = await i18n();
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
      ...(query.repay === "1" ? { status: "REFUNDED", refundPaidAt: null } : {}),
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
      refundNote: true,
      refundPaidAt: true,
      buyer: { select: { name: true, email: true } },
      items: { select: { deliveredAt: true } },
    },
  });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t("آخر 100 طلب")}</h1>
      <nav className="flex gap-3">
        <Link className="btn-outline" href="/admin/orders">
          {t("كل الطلبات")}
        </Link>
        <Link className="btn-outline" href="/admin/orders?review=1">
          {t("محتاج مراجعة")}
        </Link>
        <Link className="btn-outline" href="/admin/orders?repay=1">
          {t("مرتجعات لسه ما اتحوّلتش")}
        </Link>
      </nav>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {[
                t("الطلب"),
                t("الحالة"),
                t("المشتري"),
                t("المبلغ"),
                t("البوابة"),
                t("مرجع الدفع"),
                t("الإجراءات"),
              ].map((h) => (
                <th key={h} className="p-3 text-start">
                  {t(h)}
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
                    {t(orderStatusLabels[o.status])}
                    {review && (
                      <strong className="block">
                        {t("مدفوع من غير تسليم — محتاج مراجعة")}
                      </strong>
                    )}
                  </td>
                  <td>
                    {o.buyer.name}
                    <p dir="ltr">{o.buyer.email}</p>
                  </td>
                  <td>
                    {money(o.total)}
                    <p>
                      {t("المدفوع:")}{" "}
                      {o.paidAmount === null
                        ? t("غير مسجل")
                        : money(o.paidAmount)}
                    </p>
                  </td>
                  <td>{o.paymentProvider ?? "—"}</td>
                  <td>
                    {o.paymentRef?.startsWith("intent:") ||
                    o.paymentRef === "creating"
                      ? t("بانتظار نتيجة الدفع")
                      : (o.paymentRef ?? "—")}
                  </td>
                  <td className="min-w-64 space-y-4 p-3">
                    {review && (
                      <>
                        <p>{o.reviewReason ?? t("سبب المراجعة غير مسجل")}</p>
                        <ActionForm
                          action={retryDelivery}
                          button={t("إعادة التسليم")}
                        >
                          <input type="hidden" name="id" value={o.id} />
                        </ActionForm>
                      </>
                    )}
                    {o.status === "REFUNDED" && !o.refundPaidAt && (
                      <ActionForm action={confirmRefundPaid} button={t("حوّلت الفلوس للمشتري")}>
                        <input type="hidden" name="id" value={o.id} />
                        <p className="text-amber-800">
                          {t("التاجر عمل استرداد. حوّل ")}{money(o.paidAmount ?? o.total)}{t(" للمشتري وبعدين اضغط هنا.")}
                        </p>
                        {o.refundNote && <p className="text-slate-500">{t("السبب: ")}{o.refundNote}</p>}
                      </ActionForm>
                    )}
                    {o.status === "PAID" && (
                      <ActionForm
                        action={recordRefund}
                        button={t("تم رد الفلوس للمشتري")}
                      >
                        <input type="hidden" name="id" value={o.id} />
                        <p>
                          {t("سجّل بس بعد ما ترجع الفلوس فعليًا من بوابة الدفع أو التحويل.")}
                        </p>
                        <label className="label">
                          {t("ملاحظة الاسترداد")}
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
