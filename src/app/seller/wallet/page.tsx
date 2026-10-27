import { i18n } from "@/lib/prefs";
import { frozenAmount } from "@/lib/dispute-balance";
import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { MIN_PAYOUT } from "@/lib/config";
import { computeBalance, methodLabels, payoutLabels } from "@/lib/ledger";
import { payoutUnlockAt } from "@/lib/wallet-validation";
import { BalanceCards, LedgerTable } from "@/components/ledger-view";
import { ActionForm } from "@/components/action-form";
import { saveAccount, askPayout } from "./actions";
export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { t, money, date } = await i18n();
  const { seller } = await requireSeller();
  const query = await searchParams;
  const page = Math.min(100000, Math.max(1, Number(query.page) || 1)) | 0;
  const [all, entries, payouts] = await Promise.all([
    db.ledgerEntry.findMany({
      where: { sellerId: seller.id },
      select: { amount: true, availableAt: true },
    }),
    db.ledgerEntry.findMany({
      where: { sellerId: seller.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 30,
      take: 30,
      include: {
        orderItem: {
          select: { order: { select: { id: true, number: true } } },
        },
      },
    }),
    db.payout.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const frozen = await frozenAmount(seller.id, db);
  const now = new Date();
  const future = new Map<number, number>();
  for (const e of all)
    if (e.availableAt > now)
      future.set(
        e.availableAt.getTime(),
        (future.get(e.availableAt.getTime()) ?? 0) + e.amount,
      );
  const next = [...future]
    .filter(([, amount]) => amount > 0)
    .sort(([a], [b]) => a - b)[0];
  const unlock = seller.payoutUpdatedAt
    ? payoutUnlockAt(seller.payoutUpdatedAt)
    : null;
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{t("المحفظة")}</h1>
      {seller.payoutsFrozenAt && (
        <p role="alert" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
          {t("الإدارة جمّدت السحب من متجرك: ")}{seller.payoutsFrozenReason}{t(". كلّم الدعم عشان تحل المشكلة.")}
        </p>
      )}
      <p className="card p-4">{t("مبلغ مجمّد بسبب شكوى: ")}{money(frozen)}</p>
      <BalanceCards
        frozen={frozen}
        balance={computeBalance(all, now)}
        nextAt={next ? new Date(next[0]) : null}
      />
      <section className="card space-y-4 p-5">
        <h2 className="text-xl font-bold">{t("بيانات استلام الأرباح")}</h2>
        <p>
          {t("اسم صاحب الحساب لازم يطابق اسم التوثيق. تغيير البيانات بيقفل السحب ٢٤ ساعة.")}
        </p>
        <ActionForm action={saveAccount} button={t("احفظ بيانات الحساب")}>
          <label className="label">
            {t("طريقة السحب")}
            <select
              className="input"
              name="method"
              defaultValue={seller.payoutMethod ?? "INSTAPAY"}
            >
              {Object.entries(methodLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            {t("الحساب")}
            <input
              className="input"
              name="account"
              dir="ltr"
              required
              maxLength={100}
              defaultValue={seller.payoutAccount ?? ""}
            />
          </label>
          <p>
            {t("InstaPay: name@instapay أو موبايل مصري · المحفظة: موبايل مصري · البنك: EG وبعدها ٢٧ رقم.")}
          </p>
          <label className="label">
            {t("اسم صاحب الحساب")}
            <input
              className="input"
              name="holderName"
              required
              maxLength={150}
              defaultValue={seller.payoutHolderName ?? ""}
            />
          </label>
          <label className="label">
            {t("الباسورد الحالي")}
            <input
              className="input"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={200}
            />
          </label>
        </ActionForm>
      </section>
      <section className="card space-y-4 p-5">
        <h2 className="text-xl font-bold">{t("طلب سحب")}</h2>
        <p>{t("الحد الأدنى {min}. طلب واحد قيد المراجعة في المرة، والمبلغ المعلّق مينفعش يتسحب لحد ما يتاح.", { min: money(MIN_PAYOUT) })}</p>
        {unlock && unlock > now && (
          <p role="status">{t("السحب هيتفتح: ")}{date(unlock)}</p>
        )}
        <ActionForm action={askPayout} button={t("اطلب سحب")}>
          <label className="label">
            {t("المبلغ بالجنيه")}
            <input
              className="input"
              name="amount"
              inputMode="decimal"
              required
              maxLength={10}
            />
          </label>
        </ActionForm>
      </section>
      <h2 className="text-xl font-bold">{t("حركات الرصيد")}</h2>
      <LedgerTable entries={entries} />
      <nav className="flex gap-3" aria-label={t("صفحات حركات الرصيد")}>
        {page > 1 && (
          <Link className="btn-outline" href={`?page=${page - 1}`}>
            {t("السابق")}
          </Link>
        )}
        <span>{t("صفحة ")}{page}</span>
        {page * 30 < all.length && (
          <Link className="btn-outline" href={`?page=${page + 1}`}>
            {t("التالي")}
          </Link>
        )}
      </nav>
      <h2 className="text-xl font-bold">{t("طلبات السحب")}</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {[
                t("التاريخ"),
                t("المبلغ"),
                t("الطريقة"),
                t("آخر ٤ حروف من الحساب"),
                t("الحالة"),
                t("المرجع أو سبب الرفض"),
              ].map((h) => (
                <th className="p-3 text-start" key={h}>
                  {t(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{date(p.createdAt)}</td>
                <td>{money(p.amount)}</td>
                <td>{t(methodLabels[p.method])}</td>
                <td dir="ltr">••••{p.account.slice(-4)}</td>
                <td>{t(payoutLabels[p.status])}</td>
                <td>{p.reference ?? p.rejectReason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!payouts.length && <p className="p-4">{t("لسه مفيش طلبات سحب.")}</p>}
      </div>
    </div>
  );
}
