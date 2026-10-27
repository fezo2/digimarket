import { getPrefs, i18n } from "@/lib/prefs";
import { PrefsToggle } from "./prefs-toggle";
import { unreadCounts } from "@/lib/chat";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SITE_NAME, SITE_NAME_EN } from "@/lib/config";
import { logout } from "@/app/(auth)/actions";
import { portalHref, siteHref } from "@/lib/sites";

export async function Header() {
  const { t, lang } = await i18n();
  const { theme } = await getPrefs();
  const user = await getCurrentUser();
  const unread = user
    ? [...(await unreadCounts(user.id, false, "buyer")).values()].reduce(
        (a, b) => a + b,
        0,
      )
    : 0;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link
          href="/"
          className="shrink-0 text-xl font-extrabold text-brand-600"
        >
          {lang === "en" ? SITE_NAME_EN : SITE_NAME}
        </Link>

        <form action="/search" className="hidden flex-1 md:block">
          <input
            name="q"
            type="search"
            placeholder={t("ابحث عن اشتراك، برنامج، أو متجر…")}
            className="input"
          />
        </form>

        <nav className="ms-auto flex items-center gap-2 text-sm font-medium">
          <PrefsToggle theme={theme} />
          <Link href="/search" aria-label={t("بحث")} className="btn-outline md:hidden">
            🔍
          </Link>
          {user?.role === "ADMIN" && (
            <Link href={portalHref("admin")} className="btn-outline">
              {t("لوحة الإدارة")}
            </Link>
          )}
          {user?.seller ? (
            <Link href={portalHref("seller")} className="btn-outline">
              {t("لوحة التاجر")}
            </Link>
          ) : (
            <Link
              href={siteHref("seller", "/seller/join")}
              className="hidden text-slate-600 hover:text-brand-600 sm:inline"
            >
              {t("بيع على ")}{lang === "en" ? SITE_NAME_EN : SITE_NAME}
            </Link>
          )}
          {user ? (
            <>
              <Link href="/account" className="btn-outline">
                {t("طلباتي ")}{unread > 0 && <span className="badge">{unread}</span>}
              </Link>
              <form action={logout}>
                <button className="px-2 text-slate-500 hover:text-red-600">
                  {t("خروج")}
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-outline">
                {t("دخول")}
              </Link>
              <Link href="/register" className="btn-primary">
                {t("حساب جديد")}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
