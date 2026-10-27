import { i18n } from "@/lib/prefs";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { productCardSelect } from "@/components/product-card";
import { listedProduct } from "@/lib/catalog";
import { Breadcrumbs, ProductGrid } from "@/components/store-ui";
import { storeCategories } from "@/lib/storefront";
import { SEARCH_SORTS, type SearchSort, searchProductIds } from "@/lib/search";

export const dynamic = "force-dynamic";

type Search = { q?: string; sort?: string; cat?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const { t } = await i18n();
  const q = (await searchParams).q?.trim();
  // Result pages are endless and thin; keep them out of the index but let
  // crawlers follow through to the products.
  return {
    title: q ? t("بحث: {q}", { q }) : t("كل المنتجات"),
    robots: { index: false, follow: true },
  };
}

const SUGGESTIONS = ["ChatGPT", "كاب كات", "كانفا", "نتفليكس", "اوفيس", "VPN"];

// Without a query the page browses the whole catalogue in the chosen order.
const BROWSE_ORDER = {
  relevance: { soldCount: "desc" },
  popular: { soldCount: "desc" },
  newest: { createdAt: "desc" },
  "price-asc": { price: "asc" },
  "price-desc": { price: "desc" },
} as const;

export default async function SearchPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { t, cat, num } = await i18n();
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 100) ?? "";
  const sort = (params.sort && params.sort in SEARCH_SORTS ? params.sort : "relevance") as SearchSort;

  const categories = await storeCategories();
  const category = categories.find((c) => c.slug === params.cat);
  const categoryIds = category ? [category.id, ...category.children.map((c) => c.id)] : undefined;

  let products;
  if (q) {
    const ids = await searchProductIds({ q, sort, categoryIds });
    const found = ids.length
      ? await db.product.findMany({ where: { id: { in: ids } }, select: { id: true, ...productCardSelect } })
      : [];
    const byId = new Map(found.map((p) => [p.id, p]));
    products = ids.map((id) => byId.get(id)).filter((p) => p !== undefined);
  } else {
    products = await db.product.findMany({
      where: { ...listedProduct, ...(categoryIds ? { categoryId: { in: categoryIds } } : {}) },
      orderBy: BROWSE_ORDER[sort],
      take: 60,
      select: productCardSelect,
    });
  }

  const href = (change: Partial<Search>) => {
    const next = new URLSearchParams();
    const merged = { q, sort: params.sort, cat: params.cat, ...change };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `/search?${next}`;
  };
  const sorts = Object.entries(SEARCH_SORTS).filter(([key]) => q || key !== "relevance");
  const activeSort = !q && sort === "relevance" ? "popular" : sort;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Breadcrumbs items={[{ label: t("الرئيسية"), href: "/" }, { label: q ? t("بحث: {q}", { q }) : t("كل المنتجات") }]} />
      <form className="mb-6 flex h-12 overflow-hidden rounded-xl border-2 border-brand-600 bg-(--surface)" action="/search">
        <input
          name="q"
          defaultValue={q}
          aria-label={t("بحث")}
          placeholder={t("ابحث عن اشتراك، برنامج، كورس…")}
          className="min-w-0 flex-1 bg-transparent px-4 outline-none"
          autoFocus={!q && !params.cat && !params.sort}
        />
        {params.cat && <input type="hidden" name="cat" value={params.cat} />}
        <button className="bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700">{t("بحث")}</button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-3">
            <p className="mb-2 px-2 text-sm font-bold">{t("الأقسام")}</p>
            <nav className="no-scrollbar flex gap-1 overflow-x-auto text-sm lg:flex-col">
              <Link
                href={href({ cat: undefined })}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 whitespace-nowrap ${!category ? "bg-brand-600 font-semibold text-white" : "hover:bg-slate-50"}`}
              >
                {t("كل الأقسام")}
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={href({ cat: c.slug })}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 whitespace-nowrap ${category?.id === c.id ? "bg-brand-600 font-semibold text-white" : "hover:bg-slate-50"}`}
                >
                  <span>{c.icon}</span>
                  <span className="flex-1">{cat(c)}</span>
                  {!q && <span className="text-xs opacity-70">{num(c.count)}</span>}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <div>
          <h1 className="mb-3 text-xl font-extrabold">
            {q
              ? products.length > 0
                ? t("نتائج \"{q}\" ({length}{length2})", { q, length: products.length, length2: products.length === 60 ? "+" : "" })
                : t("مالقيناش نتايج لـ \"{q}\"", { q })
              : category
                ? cat(category)
                : t("كل المنتجات")}
          </h1>
          <div className="card mb-4 flex flex-wrap items-center gap-1 p-1.5 text-sm">
            <span className="px-2 text-slate-500">{t("ترتيب:")}</span>
            {sorts.map(([key, label]) => (
              <Link
                key={key}
                href={href({ sort: key === (q ? "relevance" : "popular") ? undefined : key })}
                className={`rounded-lg px-3 py-1.5 ${activeSort === key ? "bg-brand-600 font-semibold text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {t(label)}
              </Link>
            ))}
          </div>

          {products.length === 0 ? (
            <div className="card space-y-3 p-8 text-center text-slate-600">
              <p>{q ? t("جرّب كلمة أقصر، أو اكتب اسم المنتج بالإنجليزي، أو شيل فلتر القسم.") : t("مفيش منتجات في القسم ده لسه.")}</p>
              <Suggestions />
            </div>
          ) : (
            <ProductGrid products={products} dense />
          )}
        </div>
      </div>
    </div>
  );
}

function Suggestions() {
  return (
    <div className="flex flex-wrap justify-center gap-2 text-sm">
      {SUGGESTIONS.map((s) => (
        <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="badge bg-brand-50 py-1.5 text-brand-700">
          {s}
        </Link>
      ))}
    </div>
  );
}
