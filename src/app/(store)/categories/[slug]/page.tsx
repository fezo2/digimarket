import { i18n } from "@/lib/prefs";
import { notFound } from "next/navigation";
import { listedProduct } from "@/lib/catalog";
import Link from "next/link";
import { db } from "@/lib/db";
import { productCardSelect } from "@/components/product-card";
import { Breadcrumbs, ProductGrid } from "@/components/store-ui";
import { storeCategories } from "@/lib/storefront";
import { CategoryThumb } from "@/components/category-thumb";
import { siteHref } from "@/lib/sites";
import type { Metadata } from "next";
import { absolute, describe, jsonLd } from "@/lib/seo";

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
    include: { children: { select: { id: true, nameAr: true, nameEn: true } } },
  });
  if (!category) return { title: t("القسم غير موجود") };
  const listed = await db.product.count({
    where: { ...listedProduct, categoryId: { in: [category.id, ...category.children.map((c) => c.id)] } },
  });
  const sub = category.children.map((c) => cat(c)).join(t("، "));
  const description = describe(
    t("اشتري {name} أونلاين في مصر من تجار موثّقين بتسليم فوري{sub}. ادفع بإنستاباي أو المحفظة.", {
      name: cat(category),
      sub: sub ? `: ${sub}` : "",
    }),
  );
  const url = `/categories/${encodeURIComponent(category.slug)}`;
  return {
    title: t("{nameAr} | أسعار وعروض", { nameAr: cat(category) }),
    description,
    // Sort orders are the same listing; point them all at the plain URL.
    alternates: { canonical: url },
    // An empty category is a thin page; keep it out of the index (and the
    // sitemap) until its first product is listed.
    robots: listed === 0 ? { index: false, follow: true } : undefined,
    openGraph: { url, title: cat(category), description },
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
  const url = absolute(`/categories/${encodeURIComponent(category.slug)}`);
  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t("الرئيسية"), item: absolute("/") },
        ...(category.parent
          ? [{ "@type": "ListItem", position: 2, name: cat(category.parent), item: absolute(`/categories/${encodeURIComponent(category.parent.slug)}`) }]
          : []),
        { "@type": "ListItem", position: category.parent ? 3 : 2, name: cat(category), item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: cat(category),
      url,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: products.length,
        itemListElement: products.slice(0, 30).map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: absolute(`/products/${encodeURIComponent(p.slug)}`),
          name: p.title,
        })),
      },
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
      <Breadcrumbs
        items={[
          { label: t("الرئيسية"), href: "/" },
          ...(category.parent ? [{ label: cat(category.parent), href: `/categories/${category.parent.slug}` }] : []),
          { label: cat(category) },
        ]}
      />
      <div className="mb-6 flex items-center gap-4">
        <CategoryThumb
          category={{ imageUrl: category.imageUrl, icon: category.icon ?? category.parent?.icon }}
          className="h-16 w-20 rounded-2xl text-3xl shadow-sm sm:h-20 sm:w-28"
        />
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{cat(category)}</h1>
          <p className="text-sm text-slate-500">{t("{n} منتج", { n: num(products.length) })}</p>
        </div>
      </div>

      {category.children.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-6 flex gap-3 overflow-x-auto px-4 pb-1">
          {category.children.map((c) => (
            <Link key={c.id} href={`/categories/${c.slug}`} className="group w-32 shrink-0 sm:w-36">
              <CategoryThumb
                category={c}
                className="aspect-[4/3] w-full rounded-xl text-3xl shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-lg"
              />
              <p className="mt-1.5 line-clamp-1 text-center text-sm font-semibold group-hover:text-brand-600">{cat(c)}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {/* On phones the picture tiles above already list the subcategories. */}
          {top && (
            <div className={`card p-1.5 lg:block lg:p-3 ${category.children.length > 0 ? "hidden" : ""}`}>
              <p className="mb-2 hidden px-2 text-sm font-bold lg:block">{t("الأقسام")}</p>
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
          <form className="card space-y-3 p-3 lg:p-4">
            <p className="text-sm font-bold">{t("السعر (ج.م)")}</p>
            {query.sort && <input type="hidden" name="sort" value={query.sort} />}
            <div className="flex items-center gap-2">
              <input name="min" type="number" min={0} inputMode="numeric" defaultValue={query.min} placeholder={t("من")} aria-label={t("أقل سعر")} className="input" />
              <span className="text-slate-400">–</span>
              <input name="max" type="number" min={0} inputMode="numeric" defaultValue={query.max} placeholder={t("إلى")} aria-label={t("أعلى سعر")} className="input" />
              <button className="btn-outline shrink-0 lg:hidden">{t("تطبيق")}</button>
            </div>
            <button className="btn-outline hidden w-full lg:flex">{t("تطبيق")}</button>
            {(query.min || query.max) && (
              <Link href={keep({ min: undefined, max: undefined })} className="block text-center text-xs text-slate-500 hover:text-red-600">
                {t("مسح الفلتر")}
              </Link>
            )}
          </form>
        </aside>

        <div>
          <div className="card no-scrollbar mb-4 flex items-center gap-1 overflow-x-auto p-1.5 text-sm lg:flex-wrap">
            <span className="shrink-0 px-2 text-slate-500">{t("ترتيب:")}</span>
            {[
              ["popular", t("الأكثر مبيعاً")],
              ["newest", t("الأحدث")],
              ["price-asc", t("الأرخص")],
              ["price-desc", t("الأغلى")],
            ].map(([key, label]) => (
              <Link
                key={key}
                href={keep({ sort: key === "popular" ? undefined : key })}
                className={`shrink-0 rounded-lg px-3 py-1.5 whitespace-nowrap ${sortKey === key ? "bg-brand-600 font-semibold text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {label}
              </Link>
            ))}
          </div>
          {products.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 p-10 text-center">
              <CategoryThumb
                category={{ imageUrl: category.imageUrl, icon: category.icon ?? category.parent?.icon }}
                className="h-20 w-28 rounded-2xl text-4xl"
              />
              <p className="text-lg font-bold">
                {query.min || query.max ? t("مفيش منتجات في الفلتر ده.") : t("المنتجات في القسم ده جاية قريب")}
              </p>
              <p className="max-w-md text-sm text-slate-500">
                {t("التجار الموثّقين بيضيفوا منتجات جديدة كل يوم. جرّب البحث أو قسم تاني لحد ما توصل.")}
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                <Link href="/search" className="btn-primary">{t("كل المنتجات")}</Link>
                <Link href={siteHref("seller", "/seller/join")} className="btn-outline">{t("عندك منتجات؟ ابدأ البيع")}</Link>
              </div>
            </div>
          ) : (
            <ProductGrid products={products} dense />
          )}
        </div>
      </div>
    </div>
  );
}
