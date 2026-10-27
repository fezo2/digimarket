import { i18n } from "@/lib/prefs";
import { reviewPercent } from "@/lib/community-rules";
import Link from "next/link";

export type ProductCardData = {
  slug: string;
  title: string;
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  soldCount: number;
  positiveReviews: number;
  negativeReviews: number;
  seller: { storeName: string; type: "INDIVIDUAL" | "COMPANY" };
};

export async function ProductCard({ product }: { product: ProductCardData }) {
  const { t, money } = await i18n();
  const off =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(100 - (product.price / product.compareAtPrice) * 100)
      : 0;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="card group flex flex-col overflow-hidden hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-gradient-to-br from-brand-50 to-slate-100">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-lg font-bold text-brand-700">
            {product.title.split(/[|—-]/)[0]}
          </div>
        )}
        {off > 0 && (
          <span className="badge absolute start-2 top-2 bg-red-600 text-white">
            -{off}%
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm font-semibold group-hover:text-brand-600">
          {product.title}
        </p>
        <p className="text-xs text-slate-500">
          {product.seller.storeName}
          {product.seller.type === "COMPANY" && (
            <span className="text-brand-600">{t("· شركة")}</span>
          )}
        </p>
        {product.positiveReviews + product.negativeReviews > 0 && (
          <p className="text-xs">
            {reviewPercent(product.positiveReviews, product.negativeReviews)}
          </p>
        )}
        <div className="mt-auto flex items-baseline justify-between">
          <span className="font-bold text-brand-700">
            {money(product.price)}
          </span>
          {product.soldCount > 0 && (
            <span className="text-xs text-slate-400">
              {t("اتباع ")}{product.soldCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export const productCardSelect = {
  slug: true,
  title: true,
  imageUrl: true,
  price: true,
  compareAtPrice: true,
  soldCount: true,
  positiveReviews: true,
  negativeReviews: true,
  seller: { select: { storeName: true, type: true } },
} as const;
