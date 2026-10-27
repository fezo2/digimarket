import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { sellerBalance, methodLabels, payoutLabels } from "@/lib/ledger";
import { SELLER_TIERS } from "@/lib/config";
import { ActionForm } from "@/components/action-form";
import { handlePayout } from "./actions";
export default async function AdminPayouts({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { t, money, date } = await i18n();
  await requireAdmin();
  const query = await searchParams;
  const status =
    query.status === "PAID" || query.status === "REJECTED"
      ? query.status
      : "REQUESTED";
  const payouts = await db.payout.findMany({
    where: { status },
    orderBy: { createdAt: status === "REQUESTED" ? "asc" : "desc" },
    take: 100,
    include: {
      seller: {
        include: {
          kycSubmissions: {
            where: { status: "APPROVED" },
            orderBy: { reviewedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  const balances = new Map(
    await Promise.all(
      [...new Set(payouts.map((p) => p.sellerId))].map(
        async (id) => [id, await sellerBalance(id)] as const,
      ),
    ),
  );
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t("طلبات السحب")}</h1>
      <nav className="flex gap-3">
        {Object.entries(payoutLabels).map(([key, label]) => (
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
      {payouts.map((p) => {
        const legal = p.seller.kycSubmissions[0]?.fullName;
        return (
          <section className="card space-y-4 p-5" key={p.id}>
            <h2 className="text-xl font-bold">
              <Link
                className="underline"
                href={`/admin/sellers/${p.sellerId}/ledger`}
              >
                {p.seller.storeName}
              </Link>{" "}
              · {t(SELLER_TIERS[p.seller.type].label)}
            </h2>
            <p>{t("تاريخ الطلب: ")}{date(p.createdAt)}</p>
            <p>{t("اسم التوثيق: ")}{legal ?? t("غير متوفر")}</p>
            <p
              className={
                legal?.trim() !== p.holderName.trim()
                  ? "font-bold text-red-700"
                  : ""
              }
            >
              {t("اسم صاحب الحساب:")}{" "}
              {p.holderName || t("غير مسجل — راجع الاسم قبل التحويل")}
            </p>
            <p>
              {t(methodLabels[p.method])}: <span dir="ltr">{p.account}</span>
            </p>
            <p>
              {t("المبلغ: ")}{money(p.amount)}{t(" · الرصيد المتاح الحالي:")}{" "}
              {money(balances.get(p.sellerId)!.available)}
            </p>
            <p>
              {t(payoutLabels[p.status])} · {p.reference ?? p.rejectReason ?? ""}
            </p>
            {status === "REQUESTED" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <ActionForm action={handlePayout} button={t("تم الدفع")}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="status" value="PAID" />
                  <label className="label">
                    {t("مرجع التحويل")}
                    <input
                      className="input"
                      name="text"
                      required
                      maxLength={100}
                    />
                  </label>
                </ActionForm>
                <ActionForm action={handlePayout} button={t("رفض")}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="status" value="REJECTED" />
                  <label className="label">
                    {t("سبب الرفض")}
                    <textarea
                      className="input"
                      name="text"
                      required
                      maxLength={1000}
                    />
                  </label>
                </ActionForm>
              </div>
            )}
          </section>
        );
      })}
      {!payouts.length && <p>{t("مفيش طلبات بالحالة دي.")}</p>}
    </div>
  );
}
