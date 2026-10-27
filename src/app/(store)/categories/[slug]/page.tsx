import { notFound } from "next/navigation";
import { listedProduct } from "@/lib/catalog";
import Link from "next/link";
import { db } from "@/lib/db";
import { ProductCard, productCardSelect } from "@/components/product-card";
import type { Metadata } from "next";
import { describe } from "@/lib/seo";

export const dynamic = "force-dynamic";

const SORTS = {
  popular: { soldCount: "desc" },
  newest: { createdAt: "desc" },
  "price-asc": { price: "asc" },
  "price-desc": { price: "desc" },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await db.category.findUnique({
    where: { slug: decodeURIComponent(slug) },
    include: { children: { select: { nameAr: true } } },
  });
  if (!category) return { title: "القسم غير موجود" };
  const sub = category.children.map((c) => c.nameAr).join("، ");
  const description = describe(
    `اشتري ${category.nameAr} أونلاين في مصر من تجار موثّقين بتسليم فوري${sub ? `: ${sub}` : ""}. ادفع بإنستاباي أو المحفظة.`,
  );
  const url = `/categories/${encodeURIComponent(category.slug)}`;
  return {
    title: `${category.nameAr} | أسعار وعروض`,
    description,
    // Sort orders are the same listing; point them all at the plain URL.
    alternates: { canonical: url },
    openGraph: { url, title: category.nameAr, description },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const { sort } = await searchParams;
  const category = await db.category.findUnique({
    where: { slug: decodeURIComponent(slug) },
    include: { children: { orderBy: { sortOrder: "asc" } } },
  });
  if (!category) notFound();

  const sortKey = (sort && sort in SORTS ? sort : "popular") as keyof typeof SORTS;
  const products = await db.product.findMany({
    where: {
      ...listedProduct,
      categoryId: { in: [category.id, ...category.children.map((c) => c.id)] },
    },
    orderBy: SORTS[sortKey],
    select: productCardSelect,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">
        {category.icon} {category.nameAr}
      </h1>
      {category.children.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {category.children.map((c) => (
            <Link key={c.id} href={`/categories/${c.slug}`} className="badge bg-white py-1.5 ring-1 ring-slate-200">
              {c.nameAr}
            </Link>
          ))}
        </div>
      )}
      <div className="my-6 flex gap-2 text-sm">
        {[
          ["popular", "الأكثر مبيعاً"],
          ["newest", "الأحدث"],
          ["price-asc", "الأرخص"],
          ["price-desc", "الأغلى"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`?sort=${key}`}
            className={`rounded-full px-3 py-1 ${sortKey === key ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      {products.length === 0 ? (
        <p className="card p-8 text-center text-slate-500">مفيش منتجات في القسم ده لسه.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
