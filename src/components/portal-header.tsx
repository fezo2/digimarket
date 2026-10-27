import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SITE_NAME, SITE_NAME_EN } from "@/lib/config";
import { logout } from "@/app/(auth)/actions";
import { portalHref, type Site } from "@/lib/sites";
import { getPrefs, i18n } from "@/lib/prefs";
import { PrefsToggle } from "./prefs-toggle";

const TITLES = { seller: "بوابة التجار", admin: "لوحة الإدارة" } as const;

// Header for the seller portal and the admin panel: no store search or
// buyer links, just the portal name, a link to the store and sign-out.
export async function PortalHeader({ site }: { site: Exclude<Site, "store"> }) {
  const { t, lang } = await i18n();
  const { theme } = await getPrefs();
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0f172a] text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="shrink-0 text-xl font-extrabold">
          {lang === "en" ? SITE_NAME_EN : SITE_NAME}{" "}
          <span className="text-sm font-semibold text-slate-300">
            {t(TITLES[site])}
          </span>
        </Link>
        <nav className="ms-auto flex items-center gap-3 text-sm font-medium">
          <PrefsToggle theme={theme} tone="dark" />
          <Link href={portalHref("store")} className="text-slate-300 hover:text-white">
            {t("الموقع ←")}
          </Link>
          {user ? (
            <>
              <span className="hidden text-slate-300 sm:inline">{user.name}</span>
              <form action={logout}>
                <button className="px-2 text-slate-300 hover:text-red-300">
                  {t("خروج")}
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="text-slate-300 hover:text-white">
              {t("دخول")}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
