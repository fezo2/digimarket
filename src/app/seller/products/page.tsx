import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatEGP } from "@/lib/money";
import { statusLabels } from "@/lib/product-input";
import { ProductAction } from "./action-form";

export default async function ProductsPage() {
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
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="me-auto text-2xl font-bold">المنتجات</h1>
        <Link className="btn-primary" href="/seller/products/new">
          إضافة منتج
        </Link>
        <ProductAction operation="stopAll" label="إيقاف كل المبيعات" />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-start text-sm">
          <thead>
            <tr>
              {[
                "المنتج",
                "القسم",
                "السعر",
                "الحالة",
                "المخزون",
                "المبيعات",
                "التحكم",
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
                <td className="p-3">{p.title}</td>
                <td className="p-3">{p.category.nameAr}</td>
                <td className="p-3">{formatEGP(p.price)}</td>
                <td className="p-3">
                  <span className="badge bg-slate-100">
                    {statusLabels[p.status]}
                  </span>
                </td>
                <td className="p-3">
                  {p.deliveryType === "UNIQUE_CODES" ? p._count.stock : "—"}
                </td>
                <td className="p-3">{p.soldCount}</td>
                <td className="flex flex-wrap gap-2 p-3">
                  <Link
                    className="btn-outline"
                    href={`/seller/products/${p.id}`}
                  >
                    تعديل
                  </Link>
                  <ProductAction id={p.id} operation="clone" label="نسخ" />
                  <ProductAction
                    id={p.id}
                    operation="toggle"
                    label={
                      p.salesEnabled
                        ? "المبيعات ON — إيقاف"
                        : "المبيعات OFF — تشغيل"
                    }
                  />
                  {p.deliveryType === "UNIQUE_CODES" && (
                    <Link
                      className="btn-outline"
                      href={`/seller/products/${p.id}/stock`}
                    >
                      الأكواد
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!products.length && (
          <p className="p-6">لسه مفيش منتجات. ابدأ بإضافة أول منتج.</p>
        )}
      </div>
    </>
  );
}
