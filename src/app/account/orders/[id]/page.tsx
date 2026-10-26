import { OrderChat } from "@/components/order-chat";
import { PurchaseFeedback } from "@/components/purchase-feedback";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { releaseExpiredOrders } from "@/lib/orders";
import { orderStatusLabels } from "@/lib/order-snapshot";
import { formatEGP } from "@/lib/money";
import { CopyCode, PaymentPolling } from "./delivery-controls";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/account/orders/${id}`);
  await releaseExpiredOrders();
  const order = await db.order.findFirst({
    where: { id, buyerId: user.id },
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
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
      <h1 className="text-2xl font-bold">طلب #{order.number}</h1>
      <p>
        الحالة: {orderStatusLabels[order.status]} · {formatEGP(order.total)}
      </p>
      {order.status === "PENDING_PAYMENT" && (
        <>
          <PaymentPolling />
          <Link className="btn-primary" href={`/checkout/${id}`}>
            استكمال الدفع
          </Link>
        </>
      )}
      {order.status === "CANCELLED" && (
        <p>مدة حجز الطلب انتهت. لو دفعت، استنى تأكيد بوابة الدفع.</p>
      )}
      {order.items.map((item) => {
        const content = delivered.find((d) => d.id === item.id);
        return (
          <section key={item.id} className="card space-y-4 p-6">
            <h2 className="font-bold">{item.title}</h2>
            <p>الكمية: {item.quantity}</p>
            {order.status === "PAID" && !content && (
              <p className="rounded-xl bg-amber-50 p-4">
                الدفع اتسجل، والطلب محتاج مراجعة الإدارة قبل التسليم.
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
                      افتح رابط التسليم
                    </a>
                  )}
                {content.deliveryType === "FILE" && (
                  <a
                    className="btn-primary"
                    href={`/api/orders/${item.id}/file`}
                  >
                    تحميل الملف
                  </a>
                )}
                {content.instructions && (
                  <div>
                    <h3 className="font-bold">تعليمات الاستخدام</h3>
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
        كل طلباتي
      </Link>
    </div>
  );
}
