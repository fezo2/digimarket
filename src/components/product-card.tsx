import Link from "next/link";
import { formatEGP } from "@/lib/money";

export type ProductCardData = {
  slug: string;
  title: string;
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  soldCount: number;
  seller: { storeName: string; type: "INDIVIDUAL" | "COMPANY" };
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const off =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(100 - (product.price / product.compareAtPrice) * 100)
      : 0;

  return (
    <Link href={`/products/${product.slug}`} className="card group flex flex-col overflow-hidden hover:shadow-md">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-brand-50 to-slate-100">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-lg font-bold text-brand-700">
            {product.title.split(/[|—-]/)[0]}
          </div>
        )}
        {off > 0 && (
          <span className="badge absolute start-2 top-2 bg-red-600 text-white">-{off}%</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm font-semibold group-hover:text-brand-600">{product.title}</p>
        <p className="text-xs text-slate-500">
          {product.seller.storeName}
          {product.seller.type === "COMPANY" && <span className="text-brand-600"> · شركة</span>}
        </p>
        <div className="mt-auto flex items-baseline justify-between">
          <span className="font-bold text-brand-700">{formatEGP(product.price)}</span>
          {product.soldCount > 0 && <span className="text-xs text-slate-400">اتباع {product.soldCount}</span>}
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
  seller: { select: { storeName: true, type: true } },
} as const;
