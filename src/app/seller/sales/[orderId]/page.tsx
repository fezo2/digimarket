import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { communityId } from "@/lib/community-rules";
import { formatBps, formatEGP } from "@/lib/money";
import { orderStatusLabels, readOrderSnapshot } from "@/lib/order-snapshot";
import { OrderChat } from "@/components/order-chat";
import { SellerReviewList } from "@/components/seller-review-list";
import { ActionForm } from "@/components/action-form";
import { refundSale } from "./actions";

export const metadata = { title: "تفاصيل المعاملة" };

const PROVIDERS: Record<string, string> = {
  manual: "تحويل يدوي",
  paymob: "Paymob",
  test: "تجربة",
};
const METHODS = { INSTAPAY: "InstaPay", WALLET: "محفظة إلكترونية" } as const;

// One sale as the seller sees it: who bought, from where, how it was paid,
// what was delivered, when the money unlocks, plus feedback and chat.
export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { user, seller } = await requireSeller();
  const id = communityId.safeParse((await params).orderId);
  if (!id.success) notFound();
  const order = await db.order.findFirst({
    where: {
      id: id.data,
      status: { in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] },
      items: { some: { sellerId: seller.id } },
    },
    select: {
      number: true,
      status: true,
      createdAt: true,
      paidAt: true,
      paymentProvider: true,
      refundedAt: true,
      refundNote: true,
      refundPaidAt: true,
      _count: { select: { items: { where: { sellerId: { not: seller.id } } } } },
      buyerIp: true,
      buyerCountry: true,
      buyer: { select: { email: true } },
      manualPayment: { select: { method: true } },
      items: {
        where: { sellerId: seller.id },
        select: {
          id: true,
          title: true,
          quantity: true,
          total: true,
          commissionBps: true,
          commissionAmount: true,
          sellerNet: true,
          refundedAmount: true,
          deliveredAt: true,
          optionsJson: true,
          stockItems: { select: { content: true } },
          ledger: {
            where: { type: "SALE" },
            select: { availableAt: true },
          },
          disputes: {
            select: { status: true, reason: true, createdAt: true },
          },
        },
      },
    },
  });
  if (!order) notFound();
  const [replies, buyerOrders] = await Promise.all([
    db.sellerReply.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, body: true },
    }),
    db.order.count({
      where: {
        buyer: { email: order.buyer.email },
        status: "PAID",
        items: { some: { sellerId: seller.id } },
      },
    }),
  ]);
  const paidWith = order.manualPayment
    ? `${PROVIDERS.manual} · ${METHODS[order.manualPayment.method]}`
    : (PROVIDERS[order.paymentProvider ?? ""] ?? order.paymentProvider ?? "—");

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">معاملة #{order.number}</h1>

      {order.items.map((item) => {
        const snap = (() => {
          try {
            return readOrderSnapshot(item.optionsJson);
          } catch {
            return null;
          }
        })();
        const unlock = item.ledger[0]?.availableAt;
        const open = item.disputes.filter((d) => d.status === "OPEN");
        return (
          <section key={item.id} className="card overflow-hidden">
            {open.length > 0 && (
              <p className="bg-amber-50 p-4 text-sm text-amber-900">
                فيه شكوى مفتوحة: {open[0].reason}. رد على المشتري في الرسايل
                تحت.
              </p>
            )}
            <dl className="divide-y text-sm">
              <Row label="رقم الطلب">#{order.number}</Row>
              <Row label="تاريخ الطلب">
                {order.createdAt.toLocaleString("ar-EG")}
              </Row>
              <Row label="المشتري">
                <a className="text-brand-600 underline" dir="ltr" href={`mailto:${order.buyer.email}`}>
                  {order.buyer.email}
                </a>
                <span className="ms-2 text-slate-500">
                  ({buyerOrders.toLocaleString("ar-EG")} طلب مدفوع من متجرك)
                </span>
              </Row>
              <Row label="عنوان IP">
                <span dir="ltr">{order.buyerIp ?? "—"}</span>
                {order.buyerCountry && (
                  <span className="ms-2 text-slate-500">({order.buyerCountry})</span>
                )}
              </Row>
              <Row label="حالة الدفع">
                <span className="font-semibold text-emerald-700">
                  {orderStatusLabels[order.status]}
                </span>
              </Row>
              <Row label="طريقة الدفع">{paidWith}</Row>
              <Row label="تأكيد الدفع">
                {order.paidAt?.toLocaleString("ar-EG") ?? "—"}
              </Row>
              <Row label="المنتج">
                {item.title} × {item.quantity.toLocaleString("ar-EG")}
              </Row>
              {snap?.choices.length ? (
                <Row label="اختيارات المشتري">
                  {snap.choices.map((c) => `${c.name}: ${c.value}`).join(" · ")}
                </Row>
              ) : null}
              <Row label="المدفوع">{formatEGP(item.total)}</Row>
              <Row label="عمولة المنصة">
                {formatEGP(item.commissionAmount)} ({formatBps(item.commissionBps)})
              </Row>
              <Row label="صافي ليك">
                <span className="font-semibold text-emerald-700">
                  {formatEGP(item.sellerNet)}
                </span>
                {unlock && (
                  <span className="ms-2 text-slate-500">
                    {unlock > new Date()
                      ? `متاح للسحب بعد ${unlock.toLocaleString("ar-EG")}`
                      : "متاح للسحب"}
                  </span>
                )}
              </Row>
              {item.refundedAmount > 0 && (
                <Row label="المسترد">
                  <span className="text-red-700">{formatEGP(item.refundedAmount)}</span>
                </Row>
              )}
              {item.stockItems.length > 0 && (
                <Row label="الكود المسلّم">
                  <div className="space-y-1 font-mono" dir="ltr">
                    {item.stockItems.map((s, i) => (
                      <p key={i} className="break-all">{s.content}</p>
                    ))}
                  </div>
                </Row>
              )}
              <Row label="حالة التسليم">
                {item.deliveredAt ? (
                  <span className="text-emerald-700">
                    اتسلّم {item.deliveredAt.toLocaleString("ar-EG")}
                  </span>
                ) : (
                  <span className="text-amber-700">مستني مراجعة الإدارة</span>
                )}
              </Row>
            </dl>
          </section>
        );
      })}

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">استرداد الفلوس</h2>
        {order.status === "PAID" && order._count.items === 0 ? (
          <ActionForm action={refundSale} button="رجّع الفلوس للمشتري">
            <input type="hidden" name="id" value={id.data} />
            <p className="text-sm text-slate-600">
              المبلغ هيتخصم من رصيدك ({formatEGP(order.items.reduce((s, i) => s + i.sellerNet, 0))}
              ) والإدارة هتحوّل الفلوس للمشتري. الكود المسلّم مش هيرجع للمخزون، والشكوى
              المفتوحة على الطلب هتتقفل.
            </p>
            <label className="label">
              سبب الاسترداد (المشتري هيشوفه)
              <textarea className="input" name="note" required maxLength={1000} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="confirm" required />
              متأكد، الخطوة دي مش بترجع
            </label>
          </ActionForm>
        ) : order.status === "PAID" ? (
          <p className="text-sm text-slate-600">
            الطلب ده فيه منتجات من متاجر تانية، كلم الإدارة لو محتاج استرداد.
          </p>
        ) : order.refundedAt ? (
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-red-700">
              اتردّ {order.refundedAt.toLocaleString("ar-EG")}
            </p>
            {order.refundNote && <p className="text-slate-600">السبب: {order.refundNote}</p>}
            <p className="text-slate-500">
              {order.refundPaidAt
                ? `الفلوس وصلت للمشتري ${order.refundPaidAt.toLocaleString("ar-EG")}`
                : "مستني الإدارة تحوّل الفلوس للمشتري"}
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">التقييم</h2>
        <SellerReviewList sellerId={seller.id} orderId={id.data} />
      </section>

      <OrderChat userId={user.id} orderId={id.data} replies={replies} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-5 py-3 sm:grid-cols-[180px_1fr]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
