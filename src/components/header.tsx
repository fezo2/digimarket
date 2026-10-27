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
      <div className="hidden border-b border-slate-100 bg-slate-50 text-xs text-slate-500 md:block">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-1.5">
          <Link href="/pages/refunds" className="hover:text-brand-600">{t("للمشترين")}</Link>
          <Link href={siteHref("seller", "/seller/join")} className="hover:text-brand-600">
            {t("بيع على ")}{siteName}
          </Link>
          <Link href="/pages/terms" className="hover:text-brand-600">{t("الشروط والأحكام")}</Link>
          <span className="ms-auto flex items-center gap-1">
            <Icon name="bolt" className="h-3.5 w-3.5 text-amber-500" />
            {t("تسليم فوري بعد الدفع")}
          </span>
          <PrefsToggle theme={theme} />
        </div>
      </div>

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <Link href="/" className="shrink-0 text-2xl font-black tracking-tight text-brand-600">
          {siteName}
        </Link>

        <CatalogMenu
          label={t("الكتالوج")}
          allLabel={t("كل المنتجات")}
          categories={categories.map((c) => ({
            slug: c.slug,
            name: cat(c),
            icon: c.icon,
            count: c.count,
            children: c.children.map((s) => ({ slug: s.slug, name: cat(s) })),
          }))}
        />

        <form action="/search" role="search" className="order-last flex w-full md:order-none md:w-auto md:flex-1">
          <div className="flex h-11 w-full overflow-hidden rounded-xl border-2 border-brand-600 bg-(--surface)">
            <input
              name="q"
              type="search"
              aria-label={t("بحث")}
              placeholder={t("ابحث عن اشتراك، برنامج، أو متجر…")}
              className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
            />
            <button className="flex items-center gap-1 bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
              <Icon name="search" />
              <span className="hidden lg:inline">{t("بحث")}</span>
            </button>
          </div>
        </form>

        <nav className="ms-auto flex items-center gap-0.5 md:ms-0">
          <span className="md:hidden">
            <PrefsToggle theme={theme} />
          </span>
          {user?.role === "ADMIN" && (
            <NavIcon href={portalHref("admin")} icon="shield" label={t("الإدارة")} />
          )}
          {user?.seller && <NavIcon href={portalHref("seller")} icon="store" label={t("متجري")} />}
          {user ? (
            <>
              <NavIcon href="/account" icon="bag" label={t("مشترياتي")} badge={unread} />
              <form action={logout} className="hidden sm:block">
                <button className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-red-600">
                  <Icon name="logout" />
                  {t("خروج")}
                </button>
              </form>
            </>
          ) : (
            <>
              <NavIcon href="/login" icon="user" label={t("دخول")} />
              <Link href="/register" className="btn-primary ms-1 hidden sm:inline-flex">
                {t("حساب جديد")}
              </Link>
            </>
          )}
        </nav>
      </div>

      </header>

      <nav aria-label={t("الأقسام")} className="border-b border-slate-200 bg-white">
        <div className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-1.5 text-sm">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium whitespace-nowrap text-slate-600 hover:bg-brand-50 hover:text-brand-700"
            >
              <span>{c.icon}</span>
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
      className="relative flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100 hover:text-brand-600"
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
