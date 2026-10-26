import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { disputeLabels } from "@/lib/disputes";
import { sellerBalance } from "@/lib/ledger";
import { formatEGP } from "@/lib/money";
import { ActionForm } from "@/components/action-form";
import { OrderChat } from "@/components/order-chat";
import { decideDispute } from "./actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await requireAdmin();
  const query = await searchParams;
  const disputes = await db.dispute.findMany({
    where: query.id ? { id: query.id } : {},
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 100,
    include: {
      orderItem: {
        include: {
          order: { select: { id: true, number: true } },
          stockItems: { where: { status: "SOLD" }, select: { content: true } },
        },
      },
    },
  });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">الشكاوى</h1>
      {await Promise.all(
        disputes.map(async (d) => {
          const balance = await sellerBalance(d.orderItem.sellerId);
          return (
            <section className="card space-y-4 p-5" key={d.id}>
              <h2 className="font-bold">
                طلب #{d.orderItem.order.number} · {disputeLabels[d.status]}
              </h2>
              <p className="whitespace-pre-wrap">{d.reason}</p>
              <p className="whitespace-pre-wrap">{d.resolution}</p>
              <p>
                رصيد التاجر: {formatEGP(balance.available)} متاح ·{" "}
                {formatEGP(balance.held)} معلّق
              </p>
              <Link
                className="underline"
                href={`/admin/orders/${d.orderItem.orderId}`}
              >
                افتح محادثة الطلب
              </Link>
              <details>
                <summary>محتوى التسليم للإدارة</summary>
                {d.orderItem.stockItems.map((s, i) => (
                  <pre className="whitespace-pre-wrap" key={i}>
                    {s.content}
                  </pre>
                ))}
                <p className="whitespace-pre-wrap">
                  {d.orderItem.deliveryContent}
                </p>
              </details>
              {d.status === "OPEN" && (
                <div className="grid gap-5 sm:grid-cols-2">
                  {[false, true].map((refund) => (
                    <ActionForm
                      key={String(refund)}
                      action={decideDispute}
                      button={
                        refund
                          ? "رد الفلوس للمشتري — تأكيد الاسترداد الخارجي"
                          : "رفض الشكوى"
                      }
                    >
                      <input type="hidden" name="id" value={d.id} />
                      <input
                        type="hidden"
                        name="refund"
                        value={String(refund)}
                      />
                      {refund && (
                        <p>
                          بتأكيد الإجراء أنت بتؤكد إنك رجّعت الفلوس فعليًا
                          للمشتري خارج الموقع.
                        </p>
                      )}
                      <label className="label">
                        ملاحظة القرار
                        <textarea
                          className="input"
                          name="note"
                          required
                          maxLength={1000}
                        />
                      </label>
                    </ActionForm>
                  ))}
                </div>
              )}
              {query.id === d.id ? (
                <OrderChat orderId={d.orderItem.orderId} userId={user.id} />
              ) : (
                <Link className="btn-outline" href={`?id=${d.id}`}>
                  تفاصيل الشكوى والصور والمحادثة
                </Link>
              )}
            </section>
          );
        }),
      )}
    </div>
  );
}
