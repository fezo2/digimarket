import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { handleManualPayment } from "./actions";

const statusLabels = {
  SUBMITTED: "مستني المراجعة",
  CONFIRMED: "اتأكد",
  REJECTED: "اترفض",
} as const;
const methodLabels = { INSTAPAY: "إنستاباي", WALLET: "محفظة موبايل" } as const;

export default async function AdminManualPayments({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { t, money, date } = await i18n();
  await requireAdmin();
  const query = await searchParams;
  const status =
    query.status === "CONFIRMED" || query.status === "REJECTED"
      ? query.status
      : "SUBMITTED";
  const payments = await db.manualPayment.findMany({
    where: { status },
    orderBy: { createdAt: status === "SUBMITTED" ? "asc" : "desc" },
    take: 100,
    include: {
      order: {
        select: {
          id: true,
          number: true,
          total: true,
          status: true,
          reviewReason: true,
          buyer: { select: { name: true } },
        },
      },
    },
  });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t("التحويلات اليدوية")}</h1>
      <p>
        {t("قبل التأكيد افتح تطبيق البنك أو المحفظة واتأكد إن المبلغ ورقم العملية وصلوا فعلًا. صورة الإيصال لوحدها مش دليل.")}
      </p>
      <nav className="flex gap-3">
        {Object.entries(statusLabels).map(([key, label]) => (
          <Link
            className="btn-outline"
            aria-current={key === status ? "page" : undefined}
            key={key}
            href={`?status=${key}`}
          >
            {t(label)}
          </Link>
        ))}
      </nav>
      {payments.map((p) => (
        <section className="card space-y-3 p-5" key={p.id}>
          <h2 className="text-xl font-bold">
            {t("طلب #")}{p.order.number} · {money(p.order.total)}
          </h2>
          <p>
            {t("المشتري: ")}{p.order.buyer.name} ·{" "}
            {date(p.createdAt)}
          </p>
          <p>
            {t(methodLabels[p.method])}{t(" من:")}{" "}
            <span dir="ltr">{p.senderAccount}</span>
          </p>
          <p>
            {t("رقم العملية:")}{" "}
            <span dir="ltr" className="font-mono font-bold">
              {p.reference}
            </span>
          </p>
          <a
            className="btn-outline"
            href={`/api/admin/files/${p.receiptKey}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("صورة الإيصال")}
          </a>
          {p.status !== "SUBMITTED" && (
            <p>
              {t(statusLabels[p.status])}
              {p.receivedAmount !== null &&
                t(" · المبلغ اللي وصل {amount}", { amount: money(p.receivedAmount) })}
              {p.reviewNote && ` · ${p.reviewNote}`}
            </p>
          )}
          {p.order.reviewReason && (
            <p className="font-bold text-red-700">
              {t("الطلب محتاج مراجعة: ")}{p.order.reviewReason}{" "}
              <Link className="underline" href="/admin/orders">
                {t("الطلبات")}
              </Link>
            </p>
          )}
          {p.status === "SUBMITTED" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <ActionForm action={handleManualPayment} button={t("تأكيد الدفع")}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="decision" value="confirm" />
                <label className="label">
                  {t("المبلغ اللي وصل فعلًا بالجنيه")}
                  <input
                    className="input"
                    name="amount"
                    dir="ltr"
                    required
                    defaultValue={(p.order.total / 100).toFixed(2)}
                  />
                </label>
                <label className="label">
                  {t("ملاحظة (اختياري)")}
                  <input className="input" name="note" maxLength={500} />
                </label>
              </ActionForm>
              <ActionForm action={handleManualPayment} button={t("رفض التحويل")}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="decision" value="reject" />
                <label className="label">
                  {t("سبب الرفض (المشتري هيشوفه)")}
                  <textarea
                    className="input"
                    name="note"
                    required
                    maxLength={500}
                  />
                </label>
              </ActionForm>
            </div>
          )}
        </section>
      ))}
      {!payments.length && <p>{t("مفيش تحويلات بالحالة دي.")}</p>}
    </div>
  );
}
