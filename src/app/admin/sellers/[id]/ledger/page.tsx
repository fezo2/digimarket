import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { sellerBalance } from "@/lib/ledger";
import { BalanceCards, LedgerTable } from "@/components/ledger-view";
import { ActionForm } from "@/components/action-form";
import { manualAdjustment } from "./actions";
export default async function AdminSellerLedger({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const seller = await db.sellerProfile.findUnique({ where: { id } });
  if (!seller) notFound();
  const [balance, entries] = await Promise.all([
    sellerBalance(id),
    db.ledgerEntry.findMany({
      where: { sellerId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      include: {
        orderItem: {
          select: { order: { select: { id: true, number: true } } },
        },
      },
    }),
  ]);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">رصيد {seller.storeName}</h1>
      <BalanceCards balance={balance} />
      <section className="card p-5">
        <h2 className="mb-4 text-xl font-bold">تسوية يدوية</h2>
        <ActionForm action={manualAdjustment} button="سجّل التسوية">
          <input type="hidden" name="sellerId" value={id} />
          <label className="label">
            المبلغ بالجنيه (السالب للخصم)
            <input className="input" name="amount" required maxLength={11} />
          </label>
          <label className="label">
            سبب التسوية
            <textarea className="input" name="note" required maxLength={1000} />
          </label>
          <label className="label">
            باسورد الأدمن الحالي
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
      <h2 className="text-xl font-bold">آخر ٥٠ حركة</h2>
      <LedgerTable entries={entries} admin />
    </div>
  );
}
