import { getPrefs, i18n } from "@/lib/prefs";
import { PrefsToggle } from "./prefs-toggle";
import { unreadCounts } from "@/lib/chat";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SITE_NAME, SITE_NAME_EN } from "@/lib/config";
import { logout } from "@/app/(auth)/actions";
import { portalHref, siteHref } from "@/lib/sites";
import { storeCategories } from "@/lib/storefront";
import { CatalogMenu } from "./catalog-menu";
import { Icon, type IconName } from "./icons";
import { CategoryThumb } from "./category-thumb";

// Store header, laid out like the big digital-goods marketplaces: a thin
// utility bar, then logo + catalog + search + account shortcuts (the only
// part that stays pinned while scrolling), then a scrollable row of categories.
export async function Header() {
  const { t, lang, cat } = await i18n();
  const { theme } = await getPrefs();
  const [user, categories] = await Promise.all([getCurrentUser(), storeCategories()]);
  const unread = user
    ? [...(await unreadCounts(user.id, false, "buyer")).values()].reduce(
        (a, b) => a + b,
        0,
      )
    : 0;
  const siteName = lang === "en" ? SITE_NAME_EN : SITE_NAME;

  return (
    <>
      <div className="hidden bg-brand-950 text-xs text-white/70 md:block">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-1.5">
          <Link href="/pages/faq" className="hover:text-yellow-300">{t("الأسئلة الشائعة")}</Link>
          <Link href={siteHref("seller", "/seller/join")} className="hover:text-yellow-300">
            {t("بيع على ")}{siteName}
          </Link>
          <Link href="/pages/terms" className="hover:text-yellow-300">{t("الشروط والأحكام")}</Link>
          <span className="ms-auto flex items-center gap-1">
            <Icon name="bolt" className="h-3.5 w-3.5 text-yellow-400" />
            {t("تسليم فوري بعد الدفع")}
          </span>
          <PrefsToggle theme={theme} tone="dark" />
        </div>
      </div>

      <header className="sticky top-0 z-20 bg-brand-900 text-white shadow-lg shadow-brand-950/20">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <Link href="/" className="shrink-0 text-2xl font-black tracking-tight text-white">
          {siteName}
        </Link>

        <CatalogMenu
          label={t("الكتالوج")}
          allLabel={t("كل المنتجات")}
          categories={categories.map((c) => ({
            slug: c.slug,
            name: cat(c),
            icon: c.icon,
            imageUrl: c.imageUrl,
            count: c.count,
            children: c.children.map((s) => ({ slug: s.slug, name: cat(s) })),
          }))}
        />

        <form action="/search" role="search" className="order-last flex w-full md:order-none md:w-auto md:flex-1">
          <div className="flex h-11 w-full overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/15 focus-within:ring-2 focus-within:ring-yellow-400">
            <input
              name="q"
              type="search"
              aria-label={t("بحث")}
              placeholder={t("ابحث عن اشتراك، برنامج، أو متجر…")}
              className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/60"
            />
            <button className="flex items-center gap-1 bg-yellow-400 px-4 text-sm font-bold text-brand-950 hover:bg-yellow-300">
              <Icon name="search" />
              <span className="hidden lg:inline">{t("بحث")}</span>
            </button>
          </div>
        </form>

        <nav className="ms-auto flex items-center gap-0.5 md:ms-0">
          <span className="md:hidden">
            <PrefsToggle theme={theme} tone="dark" />
          </span>
          {user?.role === "ADMIN" && (
            <NavIcon href={portalHref("admin")} icon="shield" label={t("الإدارة")} />
          )}
          {user?.seller && <NavIcon href={portalHref("seller")} icon="store" label={t("متجري")} />}
          {user ? (
            <>
              <NavIcon href="/account" icon="bag" label={t("مشترياتي")} badge={unread} />
              <form action={logout} className="hidden sm:block">
                <button className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[11px] text-white/70 hover:bg-white/10 hover:text-white">
                  <Icon name="logout" />
                  {t("خروج")}
                </button>
              </form>
            </>
          ) : (
            <>
              <NavIcon href="/login" icon="user" label={t("دخول")} />
              <Link href="/register" className="btn ms-1 hidden bg-yellow-400 font-bold text-brand-950 hover:bg-yellow-300 sm:inline-flex">
                {t("حساب جديد")}
              </Link>
            </>
          )}
        </nav>
      </div>

      </header>

      <nav aria-label={t("الأقسام")} className="border-b border-slate-200 bg-(--surface)">
        <div className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-1.5 text-sm">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium whitespace-nowrap text-slate-600 hover:bg-brand-50 hover:text-brand-700"
            >
              <CategoryThumb category={c} className="h-6 w-6 rounded-md text-sm" />
              {cat(c)}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

function NavIcon({ href, icon, label, badge = 0 }: { href: string; icon: IconName; label: string; badge?: number }) {
  return (
    <Link
      href={href}
      className="relative flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[11px] text-white/80 hover:bg-white/10 hover:text-white"
    >
      <Icon name={icon} />
      {label}
      {badge > 0 && (
        <span className="absolute -top-0.5 end-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
