import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { ProductPricing } from "@/components/product-pricing";
import { SELLER_TIERS } from "@/lib/config";

export const dynamic = "force-dynamic";

const DELIVERY_LABEL = {
  UNIQUE_CODES: "كود أو حساب خاص بيك يظهر فوراً بعد الدفع",
  FILE: "ملف للتحميل فوراً بعد الدفع",
  TEXT: "التفاصيل تظهر فوراً بعد الدفع",
  LINK: "رابط التفعيل يظهر فوراً بعد الدفع",
} as const;

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await db.product.findUnique({
    where: { slug: decodeURIComponent(slug) },
    include: {
      seller: true,
      category: true,
      options: { orderBy: { sortOrder: "asc" }, include: { values: { orderBy: { sortOrder: "asc" } } } },
      quantityDiscounts: { orderBy: { minQty: "asc" } },
      reviews: { orderBy: { createdAt: "desc" }, take: 10, include: { buyer: { select: { name: true } } } },
      _count: { select: { stock: { where: { status: "AVAILABLE" } } } },
    },
  });
  if (!product || product.status !== "ACTIVE" || !product.salesEnabled) notFound();

  const inStock = product.deliveryType !== "UNIQUE_CODES" || product._count.stock > 0;
  const positive = product.reviews.filter((r) => r.positive).length;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <nav className="text-sm text-slate-500">
          <Link href={`/categories/${product.category.slug}`} className="hover:text-brand-600">{product.category.nameAr}</Link>
        </nav>
        <div className="card aspect-[16/9] overflow-hidden bg-gradient-to-br from-brand-50 to-slate-100">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-2xl font-bold text-brand-700">{product.title}</div>
          )}
        </div>
        <div className="card p-6">
          <h2 className="mb-3 text-lg font-bold">الوصف</h2>
          <p className="whitespace-pre-line leading-8 text-slate-700">{product.description}</p>
        </div>
        <div className="card p-6">
          <h2 className="mb-3 text-lg font-bold">
            التقييمات <span className="text-sm font-normal text-slate-500">({positive} إيجابي من {product.reviews.length})</span>
          </h2>
          {product.reviews.length === 0 ? (
            <p className="text-sm text-slate-500">لسه مفيش تقييمات.</p>
          ) : (
            <ul className="space-y-3">
              {product.reviews.map((r) => (
                <li key={r.id} className="border-b border-slate-100 pb-3 text-sm last:border-0">
                  <span className={r.positive ? "text-emerald-600" : "text-red-600"}>{r.positive ? "👍" : "👎"}</span>{" "}
                  <span className="font-semibold">{r.buyer.name}</span>
                  {r.comment && <p className="mt-1 text-slate-700">{r.comment}</p>}
                  {r.sellerReply && <p className="mt-1 rounded-lg bg-slate-50 p-2 text-slate-600">رد التاجر: {r.sellerReply}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="card space-y-4 p-6">
          <h1 className="text-xl font-bold leading-8">{product.title}</h1>
          <ProductPricing price={product.price} compareAtPrice={product.compareAtPrice} minQty={product.minQty} maxQty={product.maxQty} inStock={inStock} options={product.options.map(o => ({ id: o.id, name: o.name, kind: o.kind, required: o.required, values: o.values.map(v => ({ id: v.id, label: v.label, priceDelta: v.priceDelta })) }))} discounts={product.quantityDiscounts.map(d => ({ minQty: d.minQty, percentOff: d.percentOff }))} />

          <p className="text-sm text-slate-600">⚡ {DELIVERY_LABEL[product.deliveryType]}</p>
          {product.deliveryType === "UNIQUE_CODES" && (
            <p className="text-sm text-slate-500">المتاح: {product._count.stock}</p>
          )}

          <button className="btn-primary w-full" disabled>
            {inStock ? "الشراء هيتفعّل قريب" : "نفذت الكمية"}
          </button>
        </div>

        <Link href={`/stores/${product.seller.slug}`} className="card flex items-center gap-3 p-4 hover:border-brand-500">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700">
            {product.seller.storeName.slice(0, 1)}
          </div>
          <div>
            <p className="font-semibold">{product.seller.storeName}</p>
            <p className="text-xs text-emerald-700">✓ {SELLER_TIERS[product.seller.type].badge}</p>
          </div>
        </Link>
      </aside>
    </div>
  );
}
