import { i18n } from "@/lib/prefs";
import { notFound } from "next/navigation";
import { listedProduct } from "@/lib/catalog";
import Link from "next/link";
import { db } from "@/lib/db";
import { productCardSelect } from "@/components/product-card";
import { Breadcrumbs, ProductGrid } from "@/components/store-ui";
import { storeCategories } from "@/lib/storefront";
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
  const { t, cat } = await i18n();
  const { slug } = await params;
  const category = await db.category.findUnique({
    where: { slug: decodeURIComponent(slug) },
    include: { children: { select: { nameAr: true } } },
  });
  if (!category) return { title: t("القسم غير موجود") };
  const sub = category.children.map((c) => c.nameAr).join(t("، "));
  const description = describe(
    t("اشتري {name} أونلاين في مصر من تجار موثّقين بتسليم فوري{sub}. ادفع بإنستاباي أو المحفظة.", {
      name: category.nameAr,
      sub: sub ? `: ${sub}` : "",
    }),
  );
  const url = `/categories/${encodeURIComponent(category.slug)}`;
  return {
    title: t("{nameAr} | أسعار وعروض", { nameAr: cat(category) }),
    description,
    // Sort orders are the same listing; point them all at the plain URL.
    alternates: { canonical: url },
    openGraph: { url, title: category.nameAr, description },
  };
}

// "150" → 15000 piasters; anything else is ignored.
function priceParam(value?: string) {
  const egp = Number(value);
  return value && Number.isFinite(egp) && egp >= 0 ? Math.round(egp * 100) : undefined;
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; min?: string; max?: string }>;
}) {
  const { t, cat, num } = await i18n();
  const { slug } = await params;
  const query = await searchParams;
  const category = await db.category.findUnique({
    where: { slug: decodeURIComponent(slug) },
    include: { children: { orderBy: { sortOrder: "asc" } }, parent: true },
  });
  if (!category) notFound();

  const sortKey = (query.sort && query.sort in SORTS ? query.sort : "popular") as keyof typeof SORTS;
  const min = priceParam(query.min);
  const max = priceParam(query.max);
  const [products, tree] = await Promise.all([
    db.product.findMany({
      where: {
        ...listedProduct,
        categoryId: { in: [category.id, ...category.children.map((c) => c.id)] },
        ...(min !== undefined || max !== undefined ? { price: { gte: min, lte: max } } : {}),
      },
      orderBy: SORTS[sortKey],
      take: 120,
      select: productCardSelect,
    }),
    storeCategories(),
  ]);
  // The sidebar lists the subcategories of the top-level category we are in.
  const top = tree.find((c) => c.id === (category.parentId ?? category.id));
  const keep = (change: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ sort: query.sort, min: query.min, max: query.max, ...change }))
      if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `?${qs}` : "?";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Breadcrumbs
        items={[
          { label: t("الرئيسية"), href: "/" },
          ...(category.parent ? [{ label: cat(category.parent), href: `/categories/${category.parent.slug}` }] : []),
          { label: cat(category) },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
          <span>{category.icon ?? category.parent?.icon}</span>
          {cat(category)}
        </h1>
        <span className="pb-1 text-sm text-slate-500">{t("{n} منتج", { n: num(products.length) })}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {top && (
            <div className="card p-3">
              <p className="mb-2 px-2 text-sm font-bold">{t("الأقسام")}</p>
              <nav className="no-scrollbar flex gap-1 overflow-x-auto text-sm lg:flex-col">
                {[{ id: top.id, slug: top.slug, label: t("الكل"), count: top.count }, ...top.children.map((c) => ({ id: c.id, slug: c.slug, label: cat(c), count: undefined }))].map(
                  (c) => (
                    <Link
                      key={c.id}
                      href={`/categories/${c.slug}`}
                      className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 whitespace-nowrap ${
                        c.id === category.id ? "bg-brand-600 font-semibold text-white" : "hover:bg-slate-50"
                      }`}
                    >
                      {c.label}
                      {c.count !== undefined && <span className="text-xs opacity-70">{num(c.count)}</span>}
                    </Link>
                  ),
                )}
              </nav>
            </div>
          )}
          <form className="card space-y-3 p-4">
            <p className="text-sm font-bold">{t("السعر (ج.م)")}</p>
            {query.sort && <input type="hidden" name="sort" value={query.sort} />}
            <div className="flex items-center gap-2">
              <input name="min" type="number" min={0} inputMode="numeric" defaultValue={query.min} placeholder={t("من")} aria-label={t("أقل سعر")} className="input" />
              <span className="text-slate-400">–</span>
              <input name="max" type="number" min={0} inputMode="numeric" defaultValue={query.max} placeholder={t("إلى")} aria-label={t("أعلى سعر")} className="input" />
            </div>
            <button className="btn-outline w-full">{t("تطبيق")}</button>
            {(query.min || query.max) && (
              <Link href={keep({ min: undefined, max: undefined })} className="block text-center text-xs text-slate-500 hover:text-red-600">
                {t("مسح الفلتر")}
              </Link>
            )}
          </form>
        </aside>

        <div>
          <div className="card mb-4 flex flex-wrap items-center gap-1 p-1.5 text-sm">
            <span className="px-2 text-slate-500">{t("ترتيب:")}</span>
            {[
              ["popular", t("الأكثر مبيعاً")],
              ["newest", t("الأحدث")],
              ["price-asc", t("الأرخص")],
              ["price-desc", t("الأغلى")],
            ].map(([key, label]) => (
              <Link
                key={key}
                href={keep({ sort: key === "popular" ? undefined : key })}
                className={`rounded-lg px-3 py-1.5 ${sortKey === key ? "bg-brand-600 font-semibold text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {label}
              </Link>
            ))}
          </div>
          {products.length === 0 ? (
            <p className="card p-10 text-center text-slate-500">{t("مفيش منتجات في القسم ده لسه.")}</p>
          ) : (
            <ProductGrid products={products} dense />
          )}
        </div>
      </div>
    </div>
  );
}
