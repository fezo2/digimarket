import { i18n } from "@/lib/prefs";
import { PublicReviews } from "@/components/public-reviews";
import { isListed } from "@/lib/catalog";
import { listedProduct } from "@/lib/catalog";
import { productCardSelect } from "@/components/product-card";
import { Breadcrumbs, ProductScroller, SectionHeader } from "@/components/store-ui";
import { Icon } from "@/components/icons";
import { positivePercent } from "@/lib/storefront";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { BuyBox } from "@/components/product-pricing";
import { MobileBuyBar } from "@/components/mobile-buy-bar";
import { releaseExpiredOrders } from "@/lib/orders";
import { SELLER_TIERS } from "@/lib/config";
import type { Metadata } from "next";
import { absolute, describe, jsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

const DELIVERY_LABEL = {
  UNIQUE_CODES: "كود أو حساب خاص بيك يظهر فوراً بعد الدفع",
  FILE: "ملف للتحميل فوراً بعد الدفع",
  TEXT: "التفاصيل تظهر فوراً بعد الدفع",
  LINK: "رابط التفعيل يظهر فوراً بعد الدفع",
} as const;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { t, money } = await i18n();
  const { slug } = await params;
  const product = await db.product.findUnique({
    where: { slug: decodeURIComponent(slug) },
    include: { seller: true, category: true },
  });
  if (!product || !isListed(product)) return { title: t("المنتج غير موجود") };
  const url = `/products/${encodeURIComponent(product.slug)}`;
  const description = describe(
    `${t("{title} من {store} بسعر {price}.", { title: product.title, store: product.seller.storeName, price: money(product.price) })} ${product.description}`,
  );
  return {
    title: product.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: product.title,
      description,
      images: product.imageUrl ? [{ url: product.imageUrl, alt: product.title }] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: Props) {
  const { t, cat, num, money } = await i18n();
  const { slug } = await params;
  await releaseExpiredOrders();
  const product = await db.product.findUnique({
    where: { slug: decodeURIComponent(slug) },
    include: {
      seller: true,
      category: true,
      options: {
        orderBy: { sortOrder: "asc" },
        include: { values: { orderBy: { sortOrder: "asc" } } },
      },
      quantityDiscounts: { orderBy: { minQty: "asc" } },
      _count: { select: { stock: { where: { status: "AVAILABLE" } } } },
    },
  });
  if (!product || !isListed(product)) notFound();

  const inStock =
    product.deliveryType !== "UNIQUE_CODES" ||
    product._count.stock >= product.minQty;

  const url = absolute(`/products/${encodeURIComponent(product.slug)}`);
  const reviewCount = product.positiveReviews + product.negativeReviews;
  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      description: describe(product.description, 500),
      url,
      image: product.imageUrl ?? undefined,
      sku: product.id,
      category: product.category.nameAr,
      offers: {
        "@type": "Offer",
        url,
        priceCurrency: "EGP",
        price: (product.price / 100).toFixed(2),
        availability: inStock
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        seller: { "@type": "Organization", name: product.seller.storeName },
      },
      // Thumbs up/down mapped onto a 1–5 scale, only once there are reviews.
      aggregateRating:
        reviewCount > 0
          ? {
              "@type": "AggregateRating",
              ratingValue: (1 + (4 * product.positiveReviews) / reviewCount).toFixed(1),
              bestRating: 5,
              worstRating: 1,
              ratingCount: reviewCount,
            }
          : undefined,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t("الرئيسية"), item: absolute("/") },
        {
          "@type": "ListItem",
          position: 2,
          name: product.category.nameAr,
          item: absolute(`/categories/${encodeURIComponent(product.category.slug)}`),
        },
        { "@type": "ListItem", position: 3, name: product.title, item: url },
      ],
    },
  ];

  const [fromSeller, similar, sellerProducts] = await Promise.all([
    db.product.findMany({
      where: { ...listedProduct, sellerId: product.sellerId, id: { not: product.id } },
      orderBy: { soldCount: "desc" },
      take: 10,
      select: productCardSelect,
    }),
    db.product.findMany({
      where: {
        ...listedProduct,
        categoryId: product.categoryId,
        sellerId: { not: product.sellerId },
      },
      orderBy: { soldCount: "desc" },
      take: 10,
      select: productCardSelect,
    }),
    db.product.count({ where: { ...listedProduct, sellerId: product.sellerId } }),
  ]);
  const rating = positivePercent(product.positiveReviews, product.negativeReviews);
  const sellerRating = positivePercent(product.seller.positiveReviews, product.seller.negativeReviews);
  const off =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(100 - (product.price / product.compareAtPrice) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structured) }}
      />
      <Breadcrumbs
        items={[
          { label: t("الرئيسية"), href: "/" },
          { label: cat(product.category), href: `/categories/${product.category.slug}` },
          { label: product.title },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card grid grid-cols-1 gap-5 p-4 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] sm:p-5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br sm:aspect-square from-brand-50 to-slate-100">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-2xl font-bold text-brand-700">
                {product.title}
              </div>
            )}
            {off > 0 && (
              <span className="badge absolute start-3 top-3 bg-yellow-400 font-extrabold text-brand-950">-{num(off)}%</span>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <h1 className="text-xl leading-8 font-extrabold sm:text-2xl sm:leading-9">{product.title}</h1>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="badge bg-slate-100 py-1 text-slate-700">
                {t("اتباع {n}", { n: num(product.soldCount) })}
              </span>
              <a href="#reviews" className="badge bg-emerald-50 py-1 text-emerald-700">
                <Icon name="thumb" className="me-1 h-3.5 w-3.5" />
                {rating !== null
                  ? t("{p}% إيجابي ({n})", { p: num(rating), n: num(reviewCount) })
                  : t("لسه مفيش تقييمات")}
              </a>
              {product.deliveryType === "UNIQUE_CODES" && (
                <span className={`badge py-1 ${inStock ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-700"}`}>
                  {inStock ? t("المتاح: ") + num(product._count.stock) : t("نفذت الكمية")}
                </span>
              )}
            </div>
            <ul className="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
              <li className="flex items-start gap-3">
                <Icon name="bolt" className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <span>{t(DELIVERY_LABEL[product.deliveryType])}</span>
              </li>
              <li className="flex items-start gap-3">
                <Icon name="shield" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <span>{t("التاجر متحقّق من هويته، وفلوسه بتتعلّق لحد ما تتأكد إن طلبك شغّال.")}</span>
              </li>
              <li className="flex items-start gap-3">
                <Icon name="card" className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                <span>{t("ادفع بإنستاباي أو المحفظة.")}</span>
              </li>
            </ul>
            <p className="hidden line-clamp-4 text-sm leading-7 whitespace-pre-line text-slate-600 sm:block">
              {product.description}
            </p>
            <a href="#description" className="hidden text-sm font-semibold sm:block text-brand-600 hover:underline">
              {t("الوصف الكامل")}
            </a>
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <div id="buy" className="card scroll-mt-32 space-y-4 p-5 shadow-sm">
            <BuyBox
              productId={product.id}
              slug={product.slug}
              price={product.price}
              compareAtPrice={product.compareAtPrice}
              minQty={product.minQty}
              maxQty={product.maxQty}
              inStock={inStock}
              options={product.options.map((o) => ({
                id: o.id,
                name: o.name,
                kind: o.kind,
                required: o.required,
                values: o.values.map((v) => ({
                  id: v.id,
                  label: v.label,
                  priceDelta: v.priceDelta,
                })),
              }))}
              discounts={product.quantityDiscounts.map((d) => ({
                minQty: d.minQty,
                percentOff: d.percentOff,
              }))}
            />
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Icon name="bolt" className="h-4 w-4 text-amber-500" />
              {t("تسليم فوري بعد الدفع")}
            </p>
          </div>

          <div className="card p-4">
            <Link href={`/stores/${product.seller.slug}`} className="group flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-700">
                {product.seller.storeName.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold group-hover:text-brand-600">{product.seller.storeName}</p>
                <p className="text-xs text-emerald-700">
                  ✓ {t(SELLER_TIERS[product.seller.type].badge)}
                </p>
              </div>
              <Icon name="chevron" className="h-4 w-4 text-slate-400 rtl:rotate-180" />
            </Link>
            <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 text-center rtl:divide-x-reverse">
              <div>
                <p className="font-extrabold">{num(sellerProducts)}</p>
                <p className="text-xs text-slate-500">{t("منتج")}</p>
              </div>
              <div>
                <p className="font-extrabold text-emerald-700">{num(product.seller.positiveReviews)}</p>
                <p className="text-xs text-slate-500">{t("تقييم إيجابي")}</p>
              </div>
              <div>
                <p className="font-extrabold">{sellerRating !== null ? `${num(sellerRating)}%` : "—"}</p>
                <p className="text-xs text-slate-500">{t("رضا المشترين")}</p>
              </div>
            </div>
            {product.seller.businessHours && (
              <p className="mt-3 text-xs text-slate-500">
                {t("ساعات العمل: ")}{product.seller.businessHours}
              </p>
            )}
          </div>
        </aside>

        <div className="space-y-6">
          <section id="description" className="card scroll-mt-24 p-5 sm:p-6">
            <h2 className="mb-3 text-lg font-extrabold">{t("الوصف")}</h2>
            <p className="leading-8 whitespace-pre-line text-slate-700">
              {product.description}
            </p>
          </section>
          <section id="reviews" className="card scroll-mt-24 p-5 sm:p-6">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-extrabold">{t("التقييمات")}</h2>
              {rating !== null && (
                <span className="badge bg-emerald-50 text-emerald-700">
                  {t("{p}% إيجابي ({n})", { p: num(rating), n: num(reviewCount) })}
                </span>
              )}
              <Link className="ms-auto text-sm font-semibold text-brand-600 hover:underline" href={`/products/${product.slug}/reviews`}>
                {t("عرض الكل")}
              </Link>
            </div>
            <PublicReviews productId={product.id} size={5} />
          </section>
        </div>
      </div>

      {fromSeller.length > 0 && (
        <section className="mt-10">
          <SectionHeader title={t("منتجات تانية من {store}", { store: product.seller.storeName })} href={`/stores/${product.seller.slug}`} />
          <ProductScroller products={fromSeller} />
        </section>
      )}
      {similar.length > 0 && (
        <section className="mt-10">
          <SectionHeader title={t("منتجات مشابهة")} href={`/categories/${product.category.slug}`} />
          <ProductScroller products={similar} />
        </section>
      )}
      {inStock && <MobileBuyBar price={money(product.price)} label={t("اشتري دلوقتي")} target="buy" />}
    </div>
  );
}
