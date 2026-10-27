import { i18n } from "@/lib/prefs";
import { positivePercent } from "@/lib/storefront";
import Link from "next/link";
import { Icon } from "./icons";

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

function discount(p: ProductCardData) {
  return p.compareAtPrice && p.compareAtPrice > p.price
    ? Math.round(100 - (p.price / p.compareAtPrice) * 100)
    : 0;
}

function Thumb({ product, big }: { product: ProductCardData; big?: boolean }) {
  return product.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={product.imageUrl}
      alt=""
      loading="lazy"
      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
    />
  ) : (
    <div
      className={`flex h-full items-center justify-center p-3 text-center font-extrabold text-brand-700 ${big ? "text-lg" : "text-xs"}`}
    >
      {product.title.split(/[|—-]/)[0]}
    </div>
  );
}

// Grid tile: picture first, then the title, a big price and the two numbers
// buyers compare sellers by (sales and positive reviews).
export async function ProductCard({ product }: { product: ProductCardData }) {
  const { t, money, num } = await i18n();
  const off = discount(product);
  const rating = positivePercent(product.positiveReviews, product.negativeReviews);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-lg"
    >
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-brand-50 to-slate-100">
        <Thumb product={product} big />
        {off > 0 && (
          <span className="badge absolute start-2 top-2 bg-yellow-400 font-extrabold text-brand-950">-{num(off)}%</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 min-h-10 text-sm leading-5 font-semibold group-hover:text-brand-600">
          {product.title}
        </p>
        <p className="truncate text-xs text-slate-500">
          {product.seller.storeName}
          {product.seller.type === "COMPANY" && <span className="text-brand-600">{t("· شركة")}</span>}
        </p>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-1">
          <span className="text-lg font-extrabold">{money(product.price)}</span>
          {off > 0 && (
            <span className="text-xs text-slate-400 line-through">{money(product.compareAtPrice!)}</span>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{product.soldCount > 0 ? t("اتباع {n}", { n: num(product.soldCount) }) : t("جديد")}</span>
          {rating !== null && (
            <span className="flex items-center gap-1 text-emerald-700">
              <Icon name="thumb" className="h-3.5 w-3.5" />
              {num(rating)}%
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// Compact row for ranked lists: small picture, title, sales and price.
export async function ProductRowItem({ product, rank }: { product: ProductCardData; rank?: number }) {
  const { t, money, num } = await i18n();
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50"
    >
      {rank !== undefined && (
        <span className="w-5 shrink-0 text-center text-sm font-bold text-slate-400">{num(rank)}</span>
      )}
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-brand-50 to-slate-100">
        <Thumb product={product} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-semibold group-hover:text-brand-600">{product.title}</p>
        <p className="text-xs text-slate-500">
          {product.seller.storeName}
          {product.soldCount > 0 && ` · ${t("اتباع {n}", { n: num(product.soldCount) })}`}
        </p>
      </div>
      <span className="shrink-0 font-extrabold">{money(product.price)}</span>
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
