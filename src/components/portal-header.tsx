import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SITE_NAME } from "@/lib/config";
import { logout } from "@/app/(auth)/actions";
import { portalHref, type Site } from "@/lib/sites";

const TITLES = { seller: "بوابة التجار", admin: "لوحة الإدارة" } as const;

// Header for the seller portal and the admin panel: no store search or
// buyer links, just the portal name, a link to the store and sign-out.
export async function PortalHeader({ site }: { site: Exclude<Site, "store"> }) {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-900 text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="shrink-0 text-xl font-extrabold">
          {SITE_NAME}{" "}
          <span className="text-sm font-semibold text-slate-300">
            {TITLES[site]}
          </span>
        </Link>
        <nav className="ms-auto flex items-center gap-3 text-sm font-medium">
          <Link href={portalHref("store")} className="text-slate-300 hover:text-white">
            الموقع ←
          </Link>
          {user ? (
            <>
              <span className="hidden text-slate-300 sm:inline">{user.name}</span>
              <form action={logout}>
                <button className="px-2 text-slate-300 hover:text-red-300">
                  خروج
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="text-slate-300 hover:text-white">
              دخول
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
