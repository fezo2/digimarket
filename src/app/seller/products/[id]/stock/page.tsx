import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { StockForm } from "../../action-form";

export default async function StockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { seller } = await requireSeller();
  if (seller.kycStatus !== "APPROVED") return null;
  const { id } = await params;
  const p = await db.product.findFirst({
    where: { id, sellerId: seller.id, deliveryType: "UNIQUE_CODES" },
    include: { stock: { orderBy: { createdAt: "desc" } } },
  });
  if (!p) notFound();
  return (
    <>
      <Link className="btn-outline" href={`/seller/products/${p.id}`}>
        رجوع للمنتج
      </Link>
      <h1 className="text-2xl font-bold">أكواد {p.title}</h1>
      <div className="card p-6">
        <StockForm id={p.id} />
      </div>
      <section className="card space-y-3 p-6">
        <h2 className="font-bold">المتاح</h2>
        {p.stock
          .filter((s) => s.status === "AVAILABLE")
          .map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 border-b pb-2"
            >
              <code dir="ltr">{s.content.slice(0, 4)}••••</code>
              <StockForm id={p.id} stockId={s.id} />
            </div>
          ))}
        {!p.stock.some((s) => s.status === "AVAILABLE") && (
          <p>مفيش أكواد متاحة.</p>
        )}
      </section>
      <section className="card space-y-3 p-6">
        <h2 className="font-bold">المباع (للعرض فقط)</h2>
        {p.stock
          .filter((s) => s.status === "SOLD")
          .map((s) => (
            <p key={s.id}>
              <code dir="ltr">{s.content.slice(0, 4)}••••</code> —{" "}
              {s.soldAt?.toLocaleString("ar-EG") ?? "—"}
            </p>
          ))}
        {!p.stock.some((s) => s.status === "SOLD") && <p>لسه مفيش مبيعات.</p>}
      </section>
    </>
  );
}
