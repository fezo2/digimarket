import { frozenAmount } from "@/lib/dispute-balance";
import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeBalance, methodLabels, payoutLabels } from "@/lib/ledger";
import { formatEGP } from "@/lib/money";
import { payoutUnlockAt } from "@/lib/wallet-validation";
import { BalanceCards, LedgerTable } from "@/components/ledger-view";
import { ActionForm } from "@/components/action-form";
import { saveAccount, askPayout } from "./actions";
export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
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
      <h1 className="text-2xl font-bold">المحفظة</h1>
      <p className="card p-4">مبلغ مجمّد بسبب شكوى: {formatEGP(frozen)}</p>
      <BalanceCards
        frozen={frozen}
        balance={computeBalance(all, now)}
        nextAt={next ? new Date(next[0]) : null}
      />
      <section className="card space-y-4 p-5">
        <h2 className="text-xl font-bold">بيانات استلام الأرباح</h2>
        <p>
          اسم صاحب الحساب لازم يطابق اسم التوثيق. تغيير البيانات بيقفل السحب ٢٤
          ساعة.
        </p>
        <ActionForm action={saveAccount} button="احفظ بيانات الحساب">
          <label className="label">
            طريقة السحب
            <select
              className="input"
              name="method"
              defaultValue={seller.payoutMethod ?? "INSTAPAY"}
            >
              {Object.entries(methodLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            الحساب
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
            InstaPay: name@instapay أو موبايل مصري · المحفظة: موبايل مصري ·
            البنك: EG وبعدها ٢٧ رقم.
          </p>
          <label className="label">
            اسم صاحب الحساب
            <input
              className="input"
              name="holderName"
              required
              maxLength={150}
              defaultValue={seller.payoutHolderName ?? ""}
            />
          </label>
          <label className="label">
            الباسورد الحالي
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
        <h2 className="text-xl font-bold">طلب سحب</h2>
        <p>الحد الأدنى ١٠٠ ج.م. طلب واحد قيد المراجعة في المرة.</p>
        {unlock && unlock > now && (
          <p role="status">السحب هيتفتح: {unlock.toLocaleString("ar-EG")}</p>
        )}
        <ActionForm action={askPayout} button="اطلب سحب">
          <label className="label">
            المبلغ بالجنيه
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
      <h2 className="text-xl font-bold">حركات الرصيد</h2>
      <LedgerTable entries={entries} />
      <nav className="flex gap-3" aria-label="صفحات حركات الرصيد">
        {page > 1 && (
          <Link className="btn-outline" href={`?page=${page - 1}`}>
            السابق
          </Link>
        )}
        <span>صفحة {page}</span>
        {page * 30 < all.length && (
          <Link className="btn-outline" href={`?page=${page + 1}`}>
            التالي
          </Link>
        )}
      </nav>
      <h2 className="text-xl font-bold">طلبات السحب</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {[
                "التاريخ",
                "المبلغ",
                "الطريقة",
                "آخر ٤ حروف من الحساب",
                "الحالة",
                "المرجع أو سبب الرفض",
              ].map((t) => (
                <th className="p-3 text-start" key={t}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{p.createdAt.toLocaleString("ar-EG")}</td>
                <td>{formatEGP(p.amount)}</td>
                <td>{methodLabels[p.method]}</td>
                <td dir="ltr">••••{p.account.slice(-4)}</td>
                <td>{payoutLabels[p.status]}</td>
                <td>{p.reference ?? p.rejectReason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!payouts.length && <p className="p-4">لسه مفيش طلبات سحب.</p>}
      </div>
    </div>
  );
}
