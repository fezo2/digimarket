import Link from "next/link";
import type { LedgerType } from "@prisma/client";
import { formatEGP } from "@/lib/money";
import { ledgerLabels } from "@/lib/ledger";
export function BalanceCards({
  balance,
  nextAt,
  frozen = 0,
}: {
  balance: { available: number; held: number; total: number };
  nextAt?: Date | null;
  frozen?: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="card p-5">
        الرصيد المتاح للسحب
        <p className="text-xl font-bold">
          {formatEGP(balance.available - frozen)}
        </p>
      </div>
      <div className="card p-5">
        رصيد معلّق<p className="text-xl font-bold">{formatEGP(balance.held)}</p>
        {nextAt && <p>أقرب إتاحة: {nextAt.toLocaleString("ar-EG")}</p>}
      </div>
      <div className="card p-5">
        الإجمالي<p className="text-xl font-bold">{formatEGP(balance.total)}</p>
      </div>
    </div>
  );
}
export function LedgerTable({
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
  const now = new Date();
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {["التاريخ", "النوع", "الطلب", "المبلغ", "متاح من", "ملاحظة"].map(
              (t) => (
                <th className="p-3 text-start" key={t}>
                  {t}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t">
              <td className="p-3">{e.createdAt.toLocaleString("ar-EG")}</td>
              <td>{ledgerLabels[e.type]}</td>
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
                {formatEGP(e.amount)}
              </td>
              <td>
                {e.availableAt > now
                  ? e.availableAt.toLocaleString("ar-EG")
                  : "متاح"}
              </td>
              <td>{e.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!entries.length && <p className="p-4">لسه مفيش حركات.</p>}
    </div>
  );
}
