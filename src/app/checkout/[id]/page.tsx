import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { releaseExpiredOrders } from "@/lib/orders";
import { readOrderSnapshot } from "@/lib/order-snapshot";
import { quote } from "@/lib/pricing";
import { CheckoutForms, Countdown } from "./checkout-forms";

export default async function Checkout({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { t } = await i18n();
  const { id } = await params;
  const user = await requireUser(`/checkout/${id}`);
  await releaseExpiredOrders();
  // Do not select delivery secrets for checkout.
  const order = await db.order.findFirst({
    where: { id, buyerId: user.id },
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      expiresAt: true,
      paymentProvider: true,
      coupon: { select: { code: true } },
      items: {
        select: {
          id: true,
          title: true,
          quantity: true,
          optionsJson: true,
          commissionBps: true,
          product: { select: { slug: true } },
        },
      },
    },
  });
  if (!order) notFound();
  if (order.status === "PAID") redirect(`/account/orders/${id}`);
  const item = order.items[0];
  if (order.status !== "PENDING_PAYMENT" || order.expiresAt <= new Date())
    return (
      <div className="mx-auto max-w-xl space-y-4 px-4 py-8">
        <h1 className="text-2xl font-bold">{t("مدة الطلب انتهت")}</h1>
        <p>{t("الحجز اتلغى. تقدر تبدأ طلب جديد.")}</p>
        {item && (
          <Link className="btn-primary" href={`/products/${item.product.slug}`}>
            {t("رجوع للمنتج")}
          </Link>
        )}
      </div>
    );
  if (!item) notFound();
  const snapshot = readOrderSnapshot(item.optionsJson);
  const beforeCoupon = quote({
    ...snapshot.pricing,
    quantity: item.quantity,
    commissionBps: item.commissionBps,
  });
  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <h1 className="text-2xl font-bold">{t("إتمام الطلب #")}{order.number}</h1>
      {(await searchParams).error && (
        <p role="alert" className="text-red-700">
          {t("الدفع منجحش. تقدر تحاول تاني.")}
        </p>
      )}
      <div className="card space-y-4 p-6">
        <h2 className="font-bold">{item.title}</h2>
        <p>{t("الكمية: ")}{item.quantity}</p>
        {snapshot.choices.map((c, i) => (
          <p key={i}>
            {c.name}: {c.value}
          </p>
        ))}
        <dl className="space-y-2">
          <Row label={t("قيمة المنتجات")} value={beforeCoupon.subtotal} />
          <Row label={t("خصم الكمية")} value={beforeCoupon.quantityDiscount} />
          <Row
            label={t("خصم الكوبون")}
            value={Math.max(0, beforeCoupon.total - order.total)}
          />
          <Row label={t("الإجمالي")} value={order.total} />
        </dl>
        <Countdown expiresAt={order.expiresAt.toISOString()} />
        <CheckoutForms
          id={id}
          coupon={order.coupon?.code ?? ""}
          locked={!!order.paymentProvider}
        />
      </div>
    </div>
  );
}
async function Row({ label, value }: { label: string; value: number }) {
  const { money } = await i18n();
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd>{money(value)}</dd>
    </div>
  );
}
