import { i18n } from "@/lib/prefs";
import { OrderChat } from "@/components/order-chat";
import { PurchaseFeedback } from "@/components/purchase-feedback";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { releaseExpiredOrders } from "@/lib/orders";
import { orderStatusLabels } from "@/lib/order-snapshot";
import { CopyCode, PaymentPolling } from "./delivery-controls";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t, money, date } = await i18n();
  const { id } = await params;
  const user = await requireUser(`/account/orders/${id}`);
  await releaseExpiredOrders();
  const order = await db.order.findFirst({
    where: { id, buyerId: user.id },
    select: {
      refundNote: true,
      refundPaidAt: true,
      id: true,
      number: true,
      status: true,
      total: true,
      paymentProvider: true,
      manualPayment: { select: { status: true, reviewNote: true } },
      items: {
        select: { id: true, title: true, quantity: true, deliveredAt: true },
      },
    },
  });
  if (!order) notFound();
  // Fetch secrets only after confirming ownership, payment AND delivery.
  const delivered =
    order.status === "PAID"
      ? await db.orderItem.findMany({
          where: {
            orderId: id,
            deliveredAt: { not: null },
            order: { buyerId: user.id, status: "PAID" },
          },
          select: {
            id: true,
            deliveryType: true,
            deliveryContent: true,
            instructions: true,
            stockItems: {
              where: { status: "SOLD" },
              select: { id: true, content: true },
            },
          },
        })
      : [];
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <h1 className="text-2xl font-bold">{t("طلب #")}{order.number}</h1>
      <p>
        {t("الحالة: ")}{t(orderStatusLabels[order.status])} · {money(order.total)}
      </p>
      {order.status === "REFUNDED" && (
        <p className="rounded-xl bg-emerald-50 p-4 text-emerald-900">
          {order.refundPaidAt
            ? t("فلوس الطلب رجعت لك {when}.", { when: date(order.refundPaidAt) })
            : t("التاجر وافق على الاسترداد، والإدارة هتحوّل لك الفلوس على نفس وسيلة الدفع قريب.")}
          {order.refundNote && <span className="block text-sm">{t("السبب: ")}{order.refundNote}</span>}
        </p>
      )}
      {order.manualPayment?.status === "SUBMITTED" && (
        <p className="rounded-xl bg-amber-50 p-4">
          {t("بنراجع التحويل بتاعك. أول ما الإدارة تأكده المنتج هيظهر هنا.")}
        </p>
      )}
      {order.manualPayment?.status === "REJECTED" && (
        <p className="rounded-xl bg-red-50 p-4 whitespace-pre-wrap">
          {t("التحويل اترفض: ")}{order.manualPayment.reviewNote}
        </p>
      )}
      {order.status === "PENDING_PAYMENT" && !order.manualPayment && (
        <>
          <PaymentPolling />
          <Link className="btn-primary" href={`/checkout/${id}`}>
            {t("استكمال الدفع")}
          </Link>
        </>
      )}
      {order.status === "CANCELLED" && !order.manualPayment && (
        <p>{t("مدة حجز الطلب انتهت. لو دفعت، استنى تأكيد الدفع أو كلّم الدعم.")}</p>
      )}
      {order.items.map((item) => {
        const content = delivered.find((d) => d.id === item.id);
        return (
          <section key={item.id} className="card space-y-4 p-6">
            <h2 className="font-bold">{item.title}</h2>
            <p>{t("الكمية: ")}{item.quantity}</p>
            {order.status === "PAID" && !content && (
              <p className="rounded-xl bg-amber-50 p-4">
                {t("الدفع اتسجل، والطلب محتاج مراجعة الإدارة قبل التسليم.")}
              </p>
            )}
            {content && (
              <>
                {content.deliveryType === "UNIQUE_CODES" &&
                  content.stockItems.map((s) => (
                    <CopyCode key={s.id} code={s.content} />
                  ))}
                {content.deliveryType === "TEXT" && (
                  <p className="whitespace-pre-wrap break-words" dir="auto">
                    {content.deliveryContent}
                  </p>
                )}
                {content.deliveryType === "LINK" &&
                  content.deliveryContent &&
                  /^https?:\/\//.test(content.deliveryContent) && (
                    <a
                      className="btn-primary"
                      href={content.deliveryContent}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("افتح رابط التسليم")}
                    </a>
                  )}
                {content.deliveryType === "FILE" && (
                  <a
                    className="btn-primary"
                    href={`/api/orders/${item.id}/file`}
                  >
                    {t("تحميل الملف")}
                  </a>
                )}
                {content.instructions && (
                  <div>
                    <h3 className="font-bold">{t("تعليمات الاستخدام")}</h3>
                    <p className="whitespace-pre-wrap">
                      {content.instructions}
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}
      <PurchaseFeedback orderId={id} userId={user.id} />
      {["PAID", "REFUNDED"].includes(order.status) && (
        <OrderChat orderId={id} userId={user.id} />
      )}
      <Link href="/account" className="btn-outline">
        {t("كل طلباتي")}
      </Link>
    </div>
  );
}
