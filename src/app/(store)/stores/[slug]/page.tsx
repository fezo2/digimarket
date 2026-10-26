import { reviewPercent } from "@/lib/community-rules";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ProductCard, productCardSelect } from "@/components/product-card";
import { SELLER_TIERS } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await db.sellerProfile.findUnique({
    where: { slug: decodeURIComponent(slug) },
    include: {
      products: {
        where: { status: "ACTIVE", salesEnabled: true },
        select: productCardSelect,
        orderBy: { soldCount: "desc" },
      },
    },
  });
  if (!store || store.kycStatus !== "APPROVED") notFound();
  // A suspended store keeps its page but lists nothing until the admin lifts it.
  if (store.salesSuspendedAt) store.products = [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="card mb-8 flex flex-wrap items-center gap-4 p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-2xl font-bold text-brand-700">
          {store.storeName.slice(0, 1)}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{store.storeName}</h1>
          <p className="mt-1 text-sm">
            <span className="badge bg-emerald-50 text-emerald-700">
              ✓ {SELLER_TIERS[store.type].badge}
            </span>
          </p>
          {store.description && (
            <p className="mt-2 text-sm text-slate-600">{store.description}</p>
          )}
        </div>
        <div className="flex gap-6 text-center text-sm">
          <div>
            <p className="text-lg font-bold">{store.products.length}</p>
            <p className="text-slate-500">منتج</p>
          </div>
          <div>
            <p className="text-lg font-bold text-emerald-600">
              {store.positiveReviews}
            </p>
            <p className="text-slate-500">تقييم إيجابي</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-600">
              {store.negativeReviews}
            </p>
            <p className="text-slate-500">تقييم سلبي</p>
          </div>
        </div>
        <p className="w-full">
          {reviewPercent(store.positiveReviews, store.negativeReviews)}
        </p>
        {store.businessHours && (
          <p className="w-full text-sm text-slate-500">
            ساعات العمل: {store.businessHours}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {store.products.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </div>
  );
}
