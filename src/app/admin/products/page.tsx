import { paginate } from "@/lib/pagination";
import { Pager } from "@/components/pager";
import type { Prisma } from "@prisma/client";
import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { SELLER_TIERS } from "@/lib/config";

const PER_PAGE = 30;

export default async function ProductQueue({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { t } = await i18n();
  await requireAdmin();
  const { page } = await searchParams;
  const pageParams = {};
  const where: Prisma.ProductWhereInput = { status: "PENDING_REVIEW" };
  const info = paginate(await db.product.count({ where }), PER_PAGE, page);
  const products = await db.product.findMany({
    where,
    skip: info.skip,
    take: info.take,
    orderBy: { updatedAt: "asc" },
    include: { seller: true },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("مراجعة المنتجات")}</h1>
      {products.map((p) => (
        <Link
          key={p.id}
          className="card block space-y-2 p-5"
          href={`/admin/products/${p.id}`}
        >
          <h2 className="font-bold">{p.title}</h2>
          <p>
            {p.seller.storeName} — {t(SELLER_TIERS[p.seller.type].label)}
          </p>
        </Link>
      ))}
      {!products.length && (
        <p className="card p-6">{t("مفيش منتجات مستنية مراجعة.")}</p>
      )}
      <Pager {...info} params={pageParams} />
    </div>
  );
}
