import { i18n } from "@/lib/prefs";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { deliveryLabels, statusLabels } from "@/lib/product-input";
import { SELLER_TIERS } from "@/lib/config";
import { ReviewForm } from "../review-form";

export default async function ProductReview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t, money, cat } = await i18n();
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
      supplier: true,
      supplierStock: true,
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
          {p.seller.storeName} — {t(SELLER_TIERS[p.seller.type].label)}
        </p>
        <p>
          {cat(p.category)} — {t(statusLabels[p.status])}
        </p>
        {p.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt={p.title} className="max-h-72 rounded-xl" />
        )}
        <p className="whitespace-pre-line">{p.description}</p>
        <p>
          {money(p.price)}
          {p.compareAtPrice && <>{t("— قبل الخصم: ")}{money(p.compareAtPrice)}</>}
        </p>
        <p>
          {t("الكمية: من ")}{p.minQty}{t(" لـ ")}{p.maxQty}
        </p>
        <p>
          {deliveryLabels[p.deliveryType]}{t(" — المخزون المتاح: ")}{p.supplier ? `${p.supplierStock ?? "?"} (ProdSeller)` : p._count.stock}
        </p>
        <p>{t("المبيعات: ")}{p.salesEnabled ? t("شغالة") : t("متوقفة")}</p>
        {p.options.map((o) => (
          <div key={o.id}>
            <h2 className="font-bold">
              {o.name} ({o.required ? t("مطلوب") : t("اختياري")})
            </h2>
            {o.kind === "text" ? (
              <p>{t("نص يكتبه المشتري")}</p>
            ) : (
              o.values.map((v) => (
                <p key={v.id}>
                  {v.label}{t(" — فرق السعر ")}{money(v.priceDelta)}
                </p>
              ))
            )}
          </div>
        ))}
        {p.quantityDiscounts.map((d) => (
          <p key={d.id}>
            {t("من ")}{d.minQty}{t(" قطعة: خصم ")}{d.percentOff}%
          </p>
        ))}
      </div>
      {p.status === "PENDING_REVIEW" && <ReviewForm id={p.id} />}
    </div>
  );
}
