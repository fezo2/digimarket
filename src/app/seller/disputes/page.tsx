import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { disputeLabels } from "@/lib/disputes";
import { paginate } from "@/lib/pagination";
import { Pager } from "@/components/pager";

const PER_PAGE = 20;

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { t } = await i18n();
  const query = await searchParams;
  const { seller } = await requireSeller();
  const where = { orderItem: { sellerId: seller.id } };
  const info = paginate(await db.dispute.count({ where }), PER_PAGE, query.page);
  const disputes = await db.dispute.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    skip: info.skip,
    take: info.take,
    include: { orderItem: { select: { orderId: true, title: true } } },
  });
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <h1 className="text-2xl font-bold">{t("الشكاوى")}</h1>
      {disputes.map((d) => (
        <section className="card p-5" key={d.id}>
          <h2>
            {d.orderItem.title} · {t(disputeLabels[d.status])}
          </h2>
          <p className="whitespace-pre-wrap">{d.reason}</p>
          <p className="whitespace-pre-wrap">{d.resolution}</p>
          <Link
            className="btn-outline"
            href={`/seller/sales/${d.orderItem.orderId}`}
          >
            {t("رد في محادثة الطلب")}
          </Link>
        </section>
      ))}
      <Pager {...info} params={query} />
    </div>
  );
}
