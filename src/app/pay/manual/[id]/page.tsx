import { i18n } from "@/lib/prefs";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { releaseExpiredOrders } from "@/lib/orders";
import { manualConfig } from "@/lib/payments/config";
import { ActionForm } from "@/components/action-form";
import { sendManualPayment } from "./actions";

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
      manualPayment: { select: { id: true } },
    },
  });
  if (!order) notFound();
  if (order.status !== "PENDING_PAYMENT" || order.manualPayment)
    redirect(`/account/orders/${id}`);
  const config = manualConfig();
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
    </div>
  );
}
