import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProductForm } from "../product-form";
import { statusLabels } from "@/lib/product-input";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { t } = await i18n();
  const { seller } = await requireSeller();
  if (seller.kycStatus !== "APPROVED") return null;
  const { id } = await params;
  const p = await db.product.findFirst({
    where: { id, sellerId: seller.id },
    include: {
      options: {
        orderBy: { sortOrder: "asc" },
        include: { values: { orderBy: { sortOrder: "asc" } } },
      },
      quantityDiscounts: { orderBy: { minQty: "asc" } },
    },
  });
  if (!p) notFound();
  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, nameAr: true, nameEn: true, parentId: true },
  });
  return (
    <>
      <h1 className="text-2xl font-bold">{t("تعديل المنتج")}</h1>
      <p>{t("الحالة: ")}{t(statusLabels[p.status])}</p>
      {(await searchParams).saved && (
        <p role="status" className="text-emerald-700">
          {t("المنتج اتحفظ")}
        </p>
      )}
      {p.reviewNote && (
        <p className="card bg-red-50 p-4">{t("سبب الرفض: ")}{p.reviewNote}</p>
      )}
      {p.deliveryType === "UNIQUE_CODES" && (
        <Link href={`/seller/products/${p.id}/stock`} className="btn-outline">
          {t("إدارة الأكواد")}
        </Link>
      )}
      <ProductForm
        categories={categories}
        defaults={{
          id: p.id,
          title: p.title,
          categoryId: p.categoryId,
          description: p.description,
          imageUrl: p.imageUrl ?? "",
          price: String(p.price / 100),
          compareAtPrice:
            p.compareAtPrice === null ? "" : String(p.compareAtPrice / 100),
          deliveryType: p.deliveryType,
          deliveryContent:
            p.deliveryType === "FILE" ? "" : (p.deliveryContent ?? ""),
          hasFile: p.deliveryType === "FILE" && !!p.deliveryContent,
          instructions: p.instructions ?? "",
          minQty: p.minQty,
          maxQty: p.maxQty,
          options: p.options.map((o) => ({
            name: o.name,
            kind: o.kind === "text" ? "text" : "select",
            required: o.required,
            values: o.values.map((v) => ({
              label: v.label,
              priceDelta: String(v.priceDelta / 100),
            })),
          })),
          discounts: p.quantityDiscounts.map((d) => ({
            minQty: d.minQty,
            percentOff: d.percentOff,
          })),
        }}
      />
    </>
  );
}
