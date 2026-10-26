import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { releaseExpiredOrders } from "@/lib/orders";
import { manualConfig } from "@/lib/payments/config";
import { formatEGP } from "@/lib/money";
import { ActionForm } from "@/components/action-form";
import { sendManualPayment } from "./actions";

export default async function ManualPayment({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
      <h1 className="text-2xl font-bold">ادفع طلب #{order.number}</h1>
      <section className="card space-y-3 p-6">
        <p className="text-lg font-bold">
          حوّل بالظبط {formatEGP(order.total)}
        </p>
        {config.instapay && (
          <p>
            إنستاباي:{" "}
            <span dir="ltr" className="font-mono font-bold">
              {config.instapay}
            </span>
          </p>
        )}
        {config.wallet && (
          <p>
            محفظة موبايل (فودافون كاش وغيرها):{" "}
            <span dir="ltr" className="font-mono font-bold">
              {config.wallet}
            </span>
          </p>
        )}
        <p>
          اكتب رقم الطلب <b>{order.number}</b> في ملاحظة التحويل لو ينفع.
        </p>
        <p className="rounded-xl bg-amber-50 p-3">
          ابعت بيانات التحويل قبل{" "}
          {order.expiresAt.toLocaleTimeString("ar-EG", {
            hour: "numeric",
            minute: "2-digit",
          })}
          ، بعدها الطلب بيتلغي. بعد ما تبعت، الإدارة بتراجع التحويل وبيوصلك
          المنتج على صفحة الطلب.
        </p>
      </section>
      <ActionForm
        action={sendManualPayment.bind(null, id)}
        button="بعت بيانات التحويل"
        uploadOrderId={id}
        uploadKind="receipt"
        uploadFields={["receipt"]}
      >
        <label className="label">
          حوّلت بإيه؟
          <select name="method" className="input" required>
            {config.instapay && <option value="INSTAPAY">إنستاباي</option>}
            {config.wallet && <option value="WALLET">محفظة موبايل</option>}
          </select>
        </label>
        <label className="label">
          الحساب أو الرقم اللي حوّلت منه
          <input
            name="senderAccount"
            className="input"
            dir="ltr"
            required
            maxLength={100}
          />
        </label>
        <label className="label">
          رقم العملية (Reference) من الإيصال
          <input
            name="reference"
            className="input"
            dir="ltr"
            required
            maxLength={40}
          />
        </label>
        <label className="label">
          صورة الإيصال (JPG أو PNG أو WebP، لحد 5 ميجا)
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
