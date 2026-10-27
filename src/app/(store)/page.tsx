import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { siteHref } from "@/lib/sites";
import { listedProduct } from "@/lib/catalog";
import { db } from "@/lib/db";
import { ProductRowItem, productCardSelect, type ProductCardData } from "@/components/product-card";
import { ProductGrid, ProductScroller, SectionHeader } from "@/components/store-ui";
import { Icon } from "@/components/icons";
import { CategoryThumb } from "@/components/category-thumb";
import { positivePercent, storeCategories } from "@/lib/storefront";
import { SELLER_TIERS } from "@/lib/config";
import { SITE_NAME, SITE_NAME_EN } from "@/lib/config";
import type { Metadata } from "next";
import { absolute, jsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const STRUCTURED = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: SITE_NAME_EN,
    url: absolute("/"),
    inLanguage: "ar-EG",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: absolute("/search?q={search_term_string}") },
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: SITE_NAME_EN,
    url: absolute("/"),
    logo: absolute("/logo.png"),
  },
];

// Subcategories shown as the "popular" strip, in this order, while they exist.
const FEATURED = [
  "steam-wallet", "pubg-uc", "chatgpt", "psn-cards", "netflix", "free-fire-diamonds",
  "itunes-cards", "canva", "xbox-game-pass", "telegram-premium", "spotify", "windows",
];

export default async function HomePage() {
  const { t, cat, num } = await i18n();
  const [categories, bestSellers, newest, discounted, topRated, topStores] = await Promise.all([
    storeCategories(),
    db.product.findMany({
      where: listedProduct,
      orderBy: { soldCount: "desc" },
      take: 30,
      select: productCardSelect,
    }),
    db.product.findMany({
      where: listedProduct,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: productCardSelect,
    }),
    db.product.findMany({
      where: { ...listedProduct, compareAtPrice: { not: null } },
      orderBy: { soldCount: "desc" },
      take: 30,
      select: productCardSelect,
    }),
    db.product.findMany({
      where: { ...listedProduct, positiveReviews: { gt: 0 } },
      orderBy: [{ positiveReviews: "desc" }, { soldCount: "desc" }],
      take: 6,
      select: productCardSelect,
    }),
    db.sellerProfile.findMany({
      where: { kycStatus: "APPROVED", salesSuspendedAt: null },
      take: 6,
      orderBy: { products: { _count: "desc" } },
      select: {
        slug: true,
        storeName: true,
        type: true,
        positiveReviews: true,
        negativeReviews: true,
        _count: { select: { products: true } },
      },
    }),
  ]);

  const subcategories = categories.flatMap((c) => c.children);
  const featured = FEATURED.map((slug) => subcategories.find((c) => c.slug === slug)).filter((c) => c !== undefined);
  const deals = discounted.filter((p) => p.compareAtPrice! > p.price).slice(0, 10);
  // Full rows only: 10 fill two rows of five, 8 two rows of four.
  const topGrid = bestSellers.length >= 10 ? bestSellers.slice(0, 10) : bestSellers.slice(0, 8);
  const ranked: ProductCardData[] = topRated.length ? topRated : bestSellers.slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(STRUCTURED) }} />

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-brand-950 via-brand-900 to-brand-600 px-6 py-10 text-white sm:px-10">
          <div className="pointer-events-none absolute -end-10 -top-10 h-56 w-56 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-16 end-24 h-40 w-40 rounded-full bg-yellow-400/20" />
          <p className="badge mb-4 bg-yellow-400 text-brand-950">
            <Icon name="bolt" className="me-1 h-3.5 w-3.5" />
            {t("تسليم فوري بعد الدفع")}
          </p>
          <h1 className="max-w-xl text-3xl leading-tight font-extrabold text-white sm:text-4xl">
            {t("اشتراكات وبرامج ومفاتيح تفعيل، من تجار موثّقين وبتسليم فوري")}
          </h1>
          <p className="mt-3 max-w-lg text-sm text-white/80 sm:text-base">
            {t("كل تاجر على ")}{t(SITE_NAME)}{t(" اتحقّقنا من هويته قبل ما يبيع. ادفع بالكارت أو المحفظة، واستلم طلبك في ثواني.")}
          </p>
          <form action="/search" className="mt-6 flex max-w-lg overflow-hidden rounded-xl bg-white/10 p-1 ring-1 ring-white/20 focus-within:ring-2 focus-within:ring-yellow-400">
            <input
              name="q"
              aria-label={t("بحث")}
              placeholder={t("جرّب: ChatGPT، كانفا، اوفيس…")}
              className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/60"
            />
            <button className="btn bg-yellow-400 font-bold text-brand-950 hover:bg-yellow-300">{t("بحث")}</button>
          </form>
        </div>
        <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-1">
          <Link
            href={siteHref("seller", "/seller/join")}
            className="card group flex flex-col justify-between bg-gradient-to-br from-amber-50 to-transparent p-5 hover:border-yellow-400"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400 text-brand-950">
              <Icon name="store" />
            </span>
            <div className="mt-4">
              <p className="text-lg font-extrabold">{t("عندك منتجات رقمية؟")}</p>
              <p className="text-sm text-slate-500">{t("افتح متجرك على ")}{t(SITE_NAME)}{t(" وابدأ البيع النهارده.")}</p>
              <p className="mt-2 text-sm font-semibold text-brand-600 group-hover:underline">{t("ابدأ البيع")}</p>
            </div>
          </Link>
          <div className="card flex flex-col justify-between bg-gradient-to-br from-brand-50 to-transparent p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Icon name="shield" />
            </span>
            <div className="mt-4">
              <p className="text-lg font-extrabold">{t("فلوسك في أمان")}</p>
              <p className="text-sm text-slate-500">{t("أرباح التاجر بتتعلّق لحد ما تتأكد إن طلبك شغّال.")}</p>
            </div>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section>
          <SectionHeader title={t("الأكثر طلباً")} icon={<Icon name="fire" className="h-6 w-6 text-yellow-500" />} />
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {featured.map((c) => (
              <Link key={c.slug} href={`/categories/${c.slug}`} className="group w-36 shrink-0 sm:w-40">
                <CategoryThumb
                  category={c}
                  className="aspect-[4/3] w-full rounded-2xl text-4xl shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-lg"
                />
                <p className="mt-2 line-clamp-1 text-center text-sm font-semibold group-hover:text-brand-600">{cat(c)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section id="categories">
        <SectionHeader title={t("الأقسام")} href="/search" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/categories/${c.slug}`}
              className="card group overflow-hidden transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-lg"
            >
              <CategoryThumb category={c} className="aspect-[4/3] w-full text-5xl transition duration-300 group-hover:scale-105" />
              <div className="relative bg-(--surface) p-3">
                <p className="line-clamp-1 font-bold">{cat(c)}</p>
                <p className="text-xs text-slate-500">
                  {c.count > 0 ? t("{n} منتج", { n: num(c.count) }) : t("{n} قسم فرعي", { n: num(c.children.length) })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {deals.length >= 3 && (
        <section className="rounded-3xl bg-gradient-to-l from-brand-50 to-amber-50 p-4 sm:p-6">
          <SectionHeader title={t("عروض وخصومات")} href="/search?sort=price-asc" />
          <ProductScroller products={deals} />
        </section>
      )}

      {bestSellers.length > 0 && (
        <section>
          <SectionHeader title={t("الأكثر مبيعاً")} href="/search?sort=popular" />
          <ProductGrid products={topGrid} dense={topGrid.length < 10} />
        </section>
      )}

      {newest.length > 0 && (
        <section>
          <SectionHeader title={t("وصل حديثاً")} href="/search?sort=newest" />
          <ProductScroller products={newest} />
        </section>
      )}

      <section className="grid items-start gap-6 lg:grid-cols-2">
        {ranked.length > 0 && (
          <div className="card p-4">
            <SectionHeader title={t("الأعلى تقييماً")} />
            <div className="space-y-1">
              {ranked.map((p, i) => (
                <ProductRowItem key={p.slug} product={p} rank={i + 1} />
              ))}
            </div>
          </div>
        )}
        {topStores.length > 0 && (
          <div className="card p-4">
            <SectionHeader title={t("متاجر موثّقة")} />
            <div className="space-y-1">
              {topStores.map((s) => {
                const rating = positivePercent(s.positiveReviews, s.negativeReviews);
                return (
                  <Link key={s.slug} href={`/stores/${s.slug}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-700">
                      {s.storeName.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{s.storeName}</span>
                      <span className="text-xs text-emerald-700">✓ {t(SELLER_TIERS[s.type].badge)}</span>
                    </span>
                    <span className="text-end text-xs text-slate-500">
                      {t("{n} منتج", { n: num(s._count.products) })}
                      {rating !== null && <span className="block text-emerald-700">{num(rating)}% 👍</span>}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
