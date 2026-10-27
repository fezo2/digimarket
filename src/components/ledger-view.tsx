import { i18n } from "@/lib/prefs";
import Link from "next/link";
import type { LedgerType } from "@prisma/client";
import { ledgerLabels } from "@/lib/ledger";
export async function BalanceCards({
  balance,
  nextAt,
  frozen = 0,
}: {
  balance: { available: number; held: number; total: number };
  nextAt?: Date | null;
  frozen?: number;
}) {
  const { t, money, date } = await i18n();
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="card p-5">
        {t("الرصيد المتاح للسحب")}
        <p className="text-xl font-bold">
          {money(balance.available - frozen)}
        </p>
      </div>
      <div className="card p-5">
        {t("رصيد معلّق")}<p className="text-xl font-bold">{money(balance.held)}</p>
        {nextAt && <p>{t("أقرب إتاحة: ")}{date(nextAt)}</p>}
      </div>
      <div className="card p-5">
        {t("الإجمالي")}<p className="text-xl font-bold">{money(balance.total)}</p>
      </div>
    </div>
  );
}
export async function LedgerTable({
  entries,
  admin = false,
}: {
  entries: {
    id: string;
    createdAt: Date;
    availableAt: Date;
    amount: number;
    type: LedgerType;
    note: string | null;
    orderItem: { order: { id: string; number: number } } | null;
  }[];
  admin?: boolean;
}) {
  const { t, money, date } = await i18n();
  const now = new Date();
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {[t("التاريخ"), t("النوع"), t("الطلب"), t("المبلغ"), t("متاح من"), t("ملاحظة")].map(
              (h) => (
                <th className="p-3 text-start" key={h}>
                  {t(h)}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t">
              <td className="p-3">{date(e.createdAt)}</td>
              <td>{t(ledgerLabels[e.type])}</td>
              <td>
                {e.orderItem ? (
                  <Link
                    className="underline"
                    href={
                      admin
                        ? `/admin/orders?order=${e.orderItem.order.id}`
                        : `/seller/sales?order=${e.orderItem.order.id}`
                    }
                  >
                    #{e.orderItem.order.number}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className={e.amount >= 0 ? "text-green-700" : "text-red-700"}>
                {money(e.amount)}
              </td>
              <td>
                {e.availableAt > now
                  ? date(e.availableAt)
                  : t("متاح")}
              </td>
              <td>{e.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!entries.length && <p className="p-4">{t("لسه مفيش حركات.")}</p>}
    </div>
  );
}
