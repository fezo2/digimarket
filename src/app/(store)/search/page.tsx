import { db } from "@/lib/db";
import { listedProduct } from "@/lib/catalog";
import { ProductCard, productCardSelect } from "@/components/product-card";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() ?? "";
  const products = q
    ? await db.product.findMany({
        where: {
          ...listedProduct,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { seller: { storeName: { contains: q, mode: "insensitive" } } },
          ],
        },
        orderBy: { soldCount: "desc" },
        take: 60,
        select: productCardSelect,
      })
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <form className="mb-6 md:hidden">
        <input name="q" defaultValue={q} placeholder="ابحث…" className="input" />
      </form>
      <h1 className="mb-6 text-xl font-bold">{q ? `نتائج البحث عن "${q}"` : "اكتب كلمة للبحث"}</h1>
      {q && products.length === 0 && <p className="card p-8 text-center text-slate-500">مالقيناش حاجة.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </div>
  );
}
