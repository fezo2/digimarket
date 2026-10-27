import { i18n } from "@/lib/prefs";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { ProductCard, productCardSelect } from "@/components/product-card";
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
    title: q ? t("بحث: {q}", { q }) : t("البحث"),
    robots: { index: false, follow: true },
  };
}

const SUGGESTIONS = ["ChatGPT", "كاب كات", "كانفا", "نتفليكس", "اوفيس", "VPN"];

export default async function SearchPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { t, cat } = await i18n();
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 100) ?? "";
  const sort = (params.sort && params.sort in SEARCH_SORTS ? params.sort : "relevance") as SearchSort;

  const categories = await db.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
    include: { children: { select: { id: true } } },
  });
  const category = categories.find((c) => c.slug === params.cat);

  const ids = q
    ? await searchProductIds({
        q,
        sort,
        categoryIds: category ? [category.id, ...category.children.map((c) => c.id)] : undefined,
      })
    : [];
  const found = ids.length
    ? await db.product.findMany({ where: { id: { in: ids } }, select: { id: true, ...productCardSelect } })
    : [];
  const byId = new Map(found.map((p) => [p.id, p]));
  const products = ids.map((id) => byId.get(id)).filter((p) => p !== undefined);

  const href = (change: Partial<Search>) => {
    const next = new URLSearchParams();
    const merged = { q, sort: params.sort, cat: params.cat, ...change };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `/search?${next}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <form className="mb-6 flex gap-2" action="/search">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("ابحث عن اشتراك، برنامج، كورس…")}
          className="input"
          autoFocus={!q}
        />
        {params.cat && <input type="hidden" name="cat" value={params.cat} />}
        <button className="btn-primary shrink-0">{t("بحث")}</button>
      </form>

      {q ? (
        <>
          <h1 className="text-xl font-bold">
            {products.length > 0
              ? t("نتائج \"{q}\" ({length}{length2})", { q, length: products.length, length2: products.length === 60 ? "+" : "" })
              : t("مالقيناش نتايج لـ \"{q}\"", { q })}
          </h1>

          <div className="my-4 flex flex-wrap gap-2 text-sm">
            <Link
              href={href({ cat: undefined })}
              className={`badge py-1.5 ring-1 ring-slate-200 ${!category ? "bg-brand-600 text-white" : "bg-white"}`}
            >
              {t("كل الأقسام")}
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={href({ cat: c.slug })}
                className={`badge py-1.5 ring-1 ring-slate-200 ${category?.id === c.id ? "bg-brand-600 text-white" : "bg-white"}`}
              >
                {c.icon} {cat(c)}
              </Link>
            ))}
          </div>
          <div className="mb-6 flex flex-wrap gap-2 text-sm">
            {Object.entries(SEARCH_SORTS).map(([key, label]) => (
              <Link
                key={key}
                href={href({ sort: key === "relevance" ? undefined : key })}
                className={sort === key ? "font-bold text-brand-700" : "text-slate-500 hover:text-brand-600"}
              >
                {t(label)}
              </Link>
            ))}
          </div>

          {products.length === 0 && (
            <div className="card space-y-3 p-8 text-center text-slate-600">
              <p>{t("جرّب كلمة أقصر، أو اكتب اسم المنتج بالإنجليزي، أو شيل فلتر القسم.")}</p>
              <Suggestions />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </>
      ) : (
        <div className="card space-y-3 p-8 text-center text-slate-600">
          <h1 className="text-xl font-bold text-slate-900">{t("بتدوّر على إيه؟")}</h1>
          <p>{t("اكتب اسم المنتج بالعربي أو بالإنجليزي.")}</p>
          <Suggestions />
        </div>
      )}
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
