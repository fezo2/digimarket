import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { deliveryLabels, statusLabels } from "@/lib/product-input";
import { formatEGP } from "@/lib/money";
import { SELLER_TIERS } from "@/lib/config";
import { ReviewForm } from "../review-form";

export default async function ProductReview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  // Delivery secrets and stock code contents are deliberately absent from this query.
  const p = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      price: true,
      compareAtPrice: true,
      minQty: true,
      maxQty: true,
      status: true,
      salesEnabled: true,
      deliveryType: true,
      category: { select: { nameAr: true } },
      seller: { select: { storeName: true, type: true } },
      options: {
        orderBy: { sortOrder: "asc" },
        include: { values: { orderBy: { sortOrder: "asc" } } },
      },
      quantityDiscounts: true,
      _count: { select: { stock: { where: { status: "AVAILABLE" } } } },
    },
  });
  if (!p) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{p.title}</h1>
      <div className="card space-y-4 p-6">
        <p>
          {p.seller.storeName} — {SELLER_TIERS[p.seller.type].label}
        </p>
        <p>
          {p.category.nameAr} — {statusLabels[p.status]}
        </p>
        {p.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt={p.title} className="max-h-72 rounded-xl" />
        )}
        <p className="whitespace-pre-line">{p.description}</p>
        <p>
          {formatEGP(p.price)}
          {p.compareAtPrice && <> — قبل الخصم: {formatEGP(p.compareAtPrice)}</>}
        </p>
        <p>
          الكمية: من {p.minQty} لـ {p.maxQty}
        </p>
        <p>
          {deliveryLabels[p.deliveryType]} — المخزون المتاح: {p._count.stock}
        </p>
        <p>المبيعات: {p.salesEnabled ? "شغالة" : "متوقفة"}</p>
        {p.options.map((o) => (
          <div key={o.id}>
            <h2 className="font-bold">
              {o.name} ({o.required ? "مطلوب" : "اختياري"})
            </h2>
            {o.kind === "text" ? (
              <p>نص يكتبه المشتري</p>
            ) : (
              o.values.map((v) => (
                <p key={v.id}>
                  {v.label} — فرق السعر {formatEGP(v.priceDelta)}
                </p>
              ))
            )}
          </div>
        ))}
        {p.quantityDiscounts.map((d) => (
          <p key={d.id}>
            من {d.minQty} قطعة: خصم {d.percentOff}%
          </p>
        ))}
      </div>
      {p.status === "PENDING_REVIEW" && <ReviewForm id={p.id} />}
    </div>
  );
}
