import { PublicReviews } from "@/components/public-reviews";
import { isListed } from "@/lib/catalog";
import { reviewPercent } from "@/lib/community-rules";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { BuyBox } from "@/components/product-pricing";
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
  const { slug } = await params;
  const product = await db.product.findUnique({
    where: { slug: decodeURIComponent(slug) },
    include: { seller: true, category: true },
  });
  if (!product || !isListed(product)) return { title: "المنتج غير موجود" };
  const url = `/products/${encodeURIComponent(product.slug)}`;
  const description = describe(
    `${product.title} من ${product.seller.storeName} بسعر ${product.price / 100} ج.م. ${product.description}`,
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
        { "@type": "ListItem", position: 1, name: "الرئيسية", item: absolute("/") },
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

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_380px]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structured) }}
      />
      <div className="space-y-6">
        <nav className="text-sm text-slate-500">
          <Link
            href={`/categories/${product.category.slug}`}
            className="hover:text-brand-600"
          >
            {product.category.nameAr}
          </Link>
        </nav>
        <div className="card aspect-[16/9] overflow-hidden bg-gradient-to-br from-brand-50 to-slate-100">
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
        </div>
        <div className="card p-6">
          <h2 className="mb-3 text-lg font-bold">الوصف</h2>
          <p className="whitespace-pre-line leading-8 text-slate-700">
            {product.description}
          </p>
        </div>
        <div className="card p-6">
          <h2 className="mb-3 text-lg font-bold">
            {reviewPercent(product.positiveReviews, product.negativeReviews)}
          </h2>
          <PublicReviews productId={product.id} />
          <Link
            className="btn-outline"
            href={`/products/${product.slug}/reviews`}
          >
            عرض الكل
          </Link>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="card space-y-4 p-6">
          <h1 className="text-xl font-bold leading-8">{product.title}</h1>
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

          <p className="text-sm text-slate-600">
            ⚡ {DELIVERY_LABEL[product.deliveryType]}
          </p>
          {product.deliveryType === "UNIQUE_CODES" && (
            <p className="text-sm text-slate-500">
              المتاح: {product._count.stock}
            </p>
          )}
        </div>

        <Link
          href={`/stores/${product.seller.slug}`}
          className="card flex items-center gap-3 p-4 hover:border-brand-500"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700">
            {product.seller.storeName.slice(0, 1)}
          </div>
          <div>
            <p className="font-semibold">{product.seller.storeName}</p>
            <p className="text-xs text-emerald-700">
              ✓ {SELLER_TIERS[product.seller.type].badge}
            </p>
          </div>
        </Link>
      </aside>
    </div>
  );
}
