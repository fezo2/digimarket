import { i18n } from "@/lib/prefs";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { releaseExpiredOrders } from "@/lib/orders";
import { manualConfig } from "@/lib/payments/config";
import { ActionForm } from "@/components/action-form";
import { sendManualPayment, setPayFrom } from "./actions";
import { autoPaymentSettings } from "@/lib/auto-payments";
import { ChatRefresh } from "@/components/chat-refresh";
import { CancelOrderButton } from "@/app/checkout/[id]/checkout-forms";

export default async function ManualPayment({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t, money, time } = await i18n();
  const { id } = await params;
  const user = await requireUser(`/pay/manual/${id}`);
  await releaseExpiredOrders();
  const order = await db.order.findFirst({
    where: { id, buyerId: user.id, paymentProvider: "manual" },
    select: {
      number: true,
      total: true,
      status: true,
      expiresAt: true,
      payFrom: true,
      payAmount: true,
      manualPayment: { select: { id: true } },
    },
  });
  if (!order) notFound();
  if (order.status !== "PENDING_PAYMENT" || order.manualPayment)
    redirect(`/account/orders/${id}`);
  const config = manualConfig();
  const auto = !!autoPaymentSettings().secret;
  const receiptForm = (
      <ActionForm
        action={sendManualPayment.bind(null, id)}
        button={t("بعت بيانات التحويل")}
        uploadOrderId={id}
        uploadKind="receipt"
        uploadFields={["receipt"]}
      >
        <label className="label">
          {t("حوّلت بإيه؟")}
          <select name="method" className="input" required>
            {config.instapay && <option value="INSTAPAY">{t("إنستاباي")}</option>}
            {config.wallet && <option value="WALLET">{t("محفظة موبايل")}</option>}
          </select>
        </label>
        <label className="label">
          {t("الحساب أو الرقم اللي حوّلت منه")}
          <input
            name="senderAccount"
            className="input"
            dir="ltr"
            required
            maxLength={100}
          />
        </label>
        <label className="label">
          {t("رقم العملية (Reference) من الإيصال")}
          <input
            name="reference"
            className="input"
            dir="ltr"
            required
            maxLength={40}
          />
        </label>
        <label className="label">
          {t("صورة الإيصال (JPG أو PNG أو WebP، لحد 5 ميجا)")}
          <input
            name="receipt"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
          />
        </label>
      </ActionForm>
  );
  if (auto && !order.payAmount)
    return (
      <div className="mx-auto max-w-xl space-y-5 px-4 py-8">
        <h1 className="text-2xl font-bold">{t("ادفع طلب #")}{order.number}</h1>
        <section className="card space-y-3 p-6">
          <p className="text-lg font-bold">
            {t("الدفع بإنستاباي أو المحفظة بيتأكد تلقائيًا")}
          </p>
          <p>
            {t("اكتب الرقم أو عنوان إنستاباي اللي هتحوّل منه، وهنديك المبلغ اللي تحوّله بالظبط. أول ما التحويل يوصل الطلب بيتأكد ويوصلك المنتج على طول.")}
          </p>
        </section>
        <ActionForm action={setPayFrom.bind(null, id)} button={t("التالي")}>
          <label className="label">
            {t("هتحوّل من رقم / حساب إيه؟")}
            <input
              name="payFrom"
              className="input"
              dir="ltr"
              required
              maxLength={80}
              placeholder="01xxxxxxxxx / name@instapay"
            />
          </label>
        </ActionForm>
        <CancelOrderButton id={id} />
      </div>
    );
  if (auto && order.payAmount)
    return (
      <div className="mx-auto max-w-xl space-y-5 px-4 py-8">
        <ChatRefresh />
        <h1 className="text-2xl font-bold">{t("ادفع طلب #")}{order.number}</h1>
        <section className="card space-y-3 p-6">
          <p>{t("حوّل المبلغ ده بالظبط (بالقروش):")}</p>
          <p className="text-3xl font-bold" dir="ltr">
            {(order.payAmount / 100).toFixed(2)} EGP
          </p>
          {config.instapay && (
            <p>
              {t("إنستاباي:")}{" "}
              <span dir="ltr" className="font-mono font-bold">
                {config.instapay}
              </span>
            </p>
          )}
          {config.wallet && (
            <p>
              {t("محفظة موبايل (فودافون كاش وغيرها):")}{" "}
              <span dir="ltr" className="font-mono font-bold">
                {config.wallet}
              </span>
            </p>
          )}
          <p>
            {t("من الرقم/الحساب:")}{" "}
            <span dir="ltr" className="font-mono">{order.payFrom}</span>
          </p>
          <p className="rounded-xl bg-amber-50 p-3">
            {t("حوّل قبل")} {time(order.expiresAt)}
            {t("، وسيب الصفحة دي مفتوحة. أول ما التحويل يوصل (عادة خلال دقيقة) الصفحة هتنقلك للمنتج لوحدها.")}
          </p>
          <p className="text-sm">
            {t("لو المحفظة مش بتقبل قروش حوّل {amount} من نفس الرقم اللي كتبته.", {
              amount: money(order.total),
            })}
          </p>
        </section>
        <ActionForm action={setPayFrom.bind(null, id)} button={t("تغيير الرقم")}>
          <label className="label">
            {t("هتحوّل من رقم تاني؟")}
            <input
              name="payFrom"
              className="input"
              dir="ltr"
              required
              maxLength={80}
              defaultValue={order.payFrom ?? ""}
            />
          </label>
        </ActionForm>
        <details className="card p-5">
          <summary className="cursor-pointer font-bold">
            {t("حوّلت ومر أكتر من 10 دقايق ولسه؟ ابعت الإيصال")}
          </summary>
          <div className="mt-4">{receiptForm}</div>
        </details>
        <CancelOrderButton id={id} />
      </div>
    );
  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <h1 className="text-2xl font-bold">{t("ادفع طلب #")}{order.number}</h1>
      <section className="card space-y-3 p-6">
        <p className="text-lg font-bold">
          {t("حوّل بالظبط ")}{money(order.total)}
        </p>
        {config.instapay && (
          <p>
            {t("إنستاباي:")}{" "}
            <span dir="ltr" className="font-mono font-bold">
              {config.instapay}
            </span>
          </p>
        )}
        {config.wallet && (
          <p>
            {t("محفظة موبايل (فودافون كاش وغيرها):")}{" "}
            <span dir="ltr" className="font-mono font-bold">
              {config.wallet}
            </span>
          </p>
        )}
        <p>
          {t("اكتب رقم الطلب ")}<b>{order.number}</b>{t("في ملاحظة التحويل لو ينفع.")}
        </p>
        <p className="rounded-xl bg-amber-50 p-3">
          {t("ابعت بيانات التحويل قبل")}{" "}
          {time(order.expiresAt)}
          {t("، بعدها الطلب بيتلغي. بعد ما تبعت، الإدارة بتراجع التحويل وبيوصلك المنتج على صفحة الطلب.")}
        </p>
      </section>
      {receiptForm}
      <CancelOrderButton id={id} />
    </div>
  );
}
