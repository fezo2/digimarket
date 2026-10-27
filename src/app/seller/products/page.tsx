import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { statusLabels } from "@/lib/product-input";
import { ProductAction } from "./action-form";
import { siteHref } from "@/lib/sites";

export default async function ProductsPage() {
  const { t, money, num, cat } = await i18n();
  const { seller } = await requireSeller();
  if (seller.kycStatus !== "APPROVED") return null;
  const products = await db.product.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      _count: { select: { stock: { where: { status: "AVAILABLE" } } } },
    },
  });
  // Units sold per product over the last 1, 3 and 6 months.
  const now = Date.now();
  const sales = await db.$queryRaw<
    { productId: string; m1: bigint; m3: bigint; m6: bigint }[]
  >`
    SELECT i."productId",
      COALESCE(SUM(i.quantity) FILTER (WHERE o."paidAt" >= ${new Date(now - 30 * 86400000)}), 0)::bigint AS m1,
      COALESCE(SUM(i.quantity) FILTER (WHERE o."paidAt" >= ${new Date(now - 91 * 86400000)}), 0)::bigint AS m3,
      COALESCE(SUM(i.quantity), 0)::bigint AS m6
    FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
    WHERE i."sellerId" = ${seller.id} AND o.status = 'PAID'
      AND o."paidAt" >= ${new Date(now - 182 * 86400000)}
    GROUP BY 1`;
  const sold = new Map(sales.map((r) => [r.productId, r]));
  const n = (v: bigint | undefined) => num(Number(v ?? 0));
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="me-auto text-2xl font-bold">{t("المنتجات")}</h1>
        <Link className="btn-primary" href="/seller/products/new">
          {t("إضافة منتج")}
        </Link>
        <ProductAction operation="stopAll" label={t("إيقاف كل المبيعات")} />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-start text-sm">
          <thead>
            <tr>
              {[
                t("المنتج"),
                t("القسم"),
                t("السعر"),
                t("الحالة"),
                t("المخزون"),
                t("مبيعات شهر / ٣ / ٦"),
                t("الإجمالي"),
                t("التحكم"),
              ].map((x) => (
                <th className="p-3 text-start" key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr className="border-t" key={p.id}>
                <td className="p-3">
                  {p.title}
                  {p.status === "ACTIVE" && (
                    <a
                      className="mt-1 block text-xs text-brand-600"
                      href={siteHref("store", `/products/${p.slug}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("رابط الشراء المباشر ↗")}
                    </a>
                  )}
                </td>
                <td className="p-3">{cat(p.category)}</td>
                <td className="p-3">{money(p.price)}</td>
                <td className="p-3">
                  <span className="badge bg-slate-100">
                    {t(statusLabels[p.status])}
                  </span>
                </td>
                <td className="p-3">
                  {p.deliveryType === "UNIQUE_CODES" ? p._count.stock : "—"}
                </td>
                <td className="p-3 whitespace-nowrap">
                  {n(sold.get(p.id)?.m1)} / {n(sold.get(p.id)?.m3)} /{" "}
                  {n(sold.get(p.id)?.m6)}
                </td>
                <td className="p-3">{num(p.soldCount)}</td>
                <td className="flex flex-wrap gap-2 p-3">
                  <Link
                    className="btn-outline"
                    href={`/seller/products/${p.id}`}
                  >
                    {t("تعديل")}
                  </Link>
                  <ProductAction id={p.id} operation="clone" label={t("نسخ")} />
                  <ProductAction
                    id={p.id}
                    operation="toggle"
                    label={
                      p.salesEnabled
                        ? t("المبيعات ON — إيقاف")
                        : t("المبيعات OFF — تشغيل")
                    }
                  />
                  {p.deliveryType === "UNIQUE_CODES" && (
                    <Link
                      className="btn-outline"
                      href={`/seller/products/${p.id}/stock`}
                    >
                      {t("الأكواد")}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!products.length && (
          <p className="p-6">{t("لسه مفيش منتجات. ابدأ بإضافة أول منتج.")}</p>
        )}
      </div>
    </>
  );
}
