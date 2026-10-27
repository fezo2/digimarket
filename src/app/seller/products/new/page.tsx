import { i18n } from "@/lib/prefs";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  const { t } = await i18n();
  const { seller } = await requireSeller();
  if (seller.kycStatus !== "APPROVED") return null;
  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, nameAr: true, nameEn: true, parentId: true },
  });
  return (
    <>
      <h1 className="text-2xl font-bold">{t("إضافة منتج")}</h1>
      <ProductForm categories={categories} />
    </>
  );
}
