import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { i18n } from "@/lib/prefs";
import { adminFrom, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { methodLabels, payoutLabels } from "@/lib/ledger";
import { paginate } from "@/lib/pagination";
import { Pager } from "@/components/pager";
import { ActionForm } from "@/components/action-form";
import { affiliateBalance } from "@/lib/affiliate";
import { payout as handle } from "../actions";

const PER_PAGE = 30;

export default async function AffiliatePayouts({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { t, money, date } = await i18n();
  const admin = await requireAdmin();
  const query = await searchParams;
  const status = query.status === "PAID" || query.status === "REJECTED" ? query.status : "REQUESTED";
  const where: Prisma.AffiliatePayoutWhereInput = { status, createdAt: adminFrom(admin) };
  const info = paginate(await db.affiliatePayout.count({ where }), PER_PAGE, query.page);
  const payouts = await db.affiliatePayout.findMany({
    where,
    orderBy: { createdAt: status === "REQUESTED" ? "asc" : "desc" },
    skip: info.skip,
    take: info.take,
    include: { affiliate: { include: { user: { select: { email: true, name: true } } } } },
  });
  const balances = new Map(
    await Promise.all(
      [...new Set(payouts.map((p) => p.affiliateId))].map(async (id) => [id, await affiliateBalance(id)] as const),
    ),
  );
  return (
    <div className="space-y-5">
      <Link href="/admin/affiliates" className="text-sm text-brand-600">← {t("برنامج الإحالة")}</Link>
      <h1 className="text-2xl font-bold">{t("طلبات سحب المسوّقين")}</h1>
      <nav className="flex gap-3">
        {Object.entries(payoutLabels).map(([key, label]) => (
          <Link className="btn-outline" aria-current={key === status ? "page" : undefined} key={key} href={`?status=${key}`}>
            {t(label)}
          </Link>
        ))}
      </nav>
      {payouts.map((p) => {
        const b = balances.get(p.affiliateId)!;
        return (
          <section className="card space-y-3 p-5" key={p.id}>
            <h2 className="text-lg font-bold">
              <Link className="underline" href={`/admin/affiliates/${p.affiliateId}`} dir="ltr">{p.affiliate.code}</Link>
              {" · "}{p.affiliate.user.name} · <span dir="ltr" className="text-sm font-normal">{p.affiliate.user.email}</span>
            </h2>
            <p>{t("تاريخ الطلب: ")}{date(p.createdAt)}</p>
            <p>{t("اسم صاحب الحساب:")} {p.holderName}</p>
            <p>{t(methodLabels[p.method])}: <span dir="ltr">{p.account}</span></p>
            <p>
              {t("المبلغ: ")}<b>{money(p.amount)}</b>{t(" · الرصيد المتاح الحالي:")} {money(b.available - b.frozen)}
              {p.affiliate.suspendedAt && <span className="ms-2 font-bold text-red-700">{t("المسوّق موقوف")}</span>}
            </p>
            {(p.reference || p.rejectReason) && <p>{p.reference ?? p.rejectReason}</p>}
            {status === "REQUESTED" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <ActionForm action={handle} button={t("تم الدفع")}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="status" value="PAID" />
                  <label className="label">
                    {t("مرجع التحويل")}
                    <input className="input" name="text" required maxLength={100} />
                  </label>
                </ActionForm>
                <ActionForm action={handle} button={t("رفض")}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="status" value="REJECTED" />
                  <label className="label">
                    {t("سبب الرفض")}
                    <textarea className="input" name="text" required maxLength={1000} />
                  </label>
                </ActionForm>
              </div>
            )}
          </section>
        );
      })}
      {!payouts.length && <p>{t("مفيش طلبات بالحالة دي.")}</p>}
      <Pager {...info} params={{ status }} />
    </div>
  );
}
