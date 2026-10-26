import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { SELLER_TIERS } from "@/lib/config";

export default async function ProductQueue() {
  await requireAdmin();
  const products = await db.product.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { updatedAt: "asc" },
    include: { seller: true },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">مراجعة المنتجات</h1>
      {products.map((p) => (
        <Link
          key={p.id}
          className="card block space-y-2 p-5"
          href={`/admin/products/${p.id}`}
        >
          <h2 className="font-bold">{p.title}</h2>
          <p>
            {p.seller.storeName} — {SELLER_TIERS[p.seller.type].label}
          </p>
        </Link>
      ))}
      {!products.length && (
        <p className="card p-6">مفيش منتجات مستنية مراجعة.</p>
      )}
    </div>
  );
}
