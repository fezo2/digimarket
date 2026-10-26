import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { disputeLabels } from "@/lib/disputes";
export default async function Page() {
  const { seller } = await requireSeller();
  const disputes = await db.dispute.findMany({
    where: { orderItem: { sellerId: seller.id } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { orderItem: { select: { orderId: true, title: true } } },
  });
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <h1 className="text-2xl font-bold">الشكاوى</h1>
      {disputes.map((d) => (
        <section className="card p-5" key={d.id}>
          <h2>
            {d.orderItem.title} · {disputeLabels[d.status]}
          </h2>
          <p className="whitespace-pre-wrap">{d.reason}</p>
          <p className="whitespace-pre-wrap">{d.resolution}</p>
          <Link
            className="btn-outline"
            href={`/seller/sales/${d.orderItem.orderId}`}
          >
            رد في محادثة الطلب
          </Link>
        </section>
      ))}
    </div>
  );
}
