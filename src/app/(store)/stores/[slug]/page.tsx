import { i18n } from "@/lib/prefs";
import { reviewPercent } from "@/lib/community-rules";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ProductCard, productCardSelect } from "@/components/product-card";
import { SELLER_TIERS } from "@/lib/config";
import type { Metadata } from "next";
import { describe } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { t } = await i18n();
  const { slug } = await params;
  const store = await db.sellerProfile.findUnique({
    where: { slug: decodeURIComponent(slug) },
    select: { slug: true, storeName: true, description: true, kycStatus: true, salesSuspendedAt: true },
  });
  if (!store || store.kycStatus !== "APPROVED") return { title: t("المتجر غير موجود") };
  const description = describe(
    store.description || t("منتجات {storeName} الرقمية على ديجي مصر، تاجر موثّق وتسليم فوري.", { storeName: store.storeName }),
  );
  const url = `/stores/${encodeURIComponent(store.slug)}`;
  return {
    title: store.storeName,
    description,
    alternates: { canonical: url },
    openGraph: { url, title: store.storeName, description },
    robots: store.salesSuspendedAt ? { index: false } : undefined,
  };
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { t } = await i18n();
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
              ✓ {t(SELLER_TIERS[store.type].badge)}
            </span>
          </p>
          {store.description && (
            <p className="mt-2 text-sm text-slate-600">{store.description}</p>
          )}
        </div>
        <div className="flex gap-6 text-center text-sm">
          <div>
            <p className="text-lg font-bold">{store.products.length}</p>
            <p className="text-slate-500">{t("منتج")}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-emerald-600">
              {store.positiveReviews}
            </p>
            <p className="text-slate-500">{t("تقييم إيجابي")}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-600">
              {store.negativeReviews}
            </p>
            <p className="text-slate-500">{t("تقييم سلبي")}</p>
          </div>
        </div>
        <p className="w-full">
          {reviewPercent(store.positiveReviews, store.negativeReviews)}
        </p>
        {store.businessHours && (
          <p className="w-full text-sm text-slate-500">
            {t("ساعات العمل: ")}{store.businessHours}
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
