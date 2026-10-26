import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SITE_NAME } from "@/lib/config";
import { logout } from "@/app/(auth)/actions";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="shrink-0 text-xl font-extrabold text-brand-600">
          {SITE_NAME}
        </Link>

        <form action="/search" className="hidden flex-1 md:block">
          <input name="q" placeholder="ابحث عن اشتراك، برنامج، أو متجر…" className="input" />
        </form>

        <nav className="ms-auto flex items-center gap-2 text-sm font-medium">
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="btn-outline">
              لوحة الإدارة
            </Link>
          )}
          {user?.seller ? (
            <Link href="/seller" className="btn-outline">
              لوحة التاجر
            </Link>
          ) : (
            <Link href="/seller/join" className="hidden text-slate-600 hover:text-brand-600 sm:inline">
              بيع على {SITE_NAME}
            </Link>
          )}
          {user ? (
            <>
              <Link href="/account" className="btn-outline">
                حسابي
              </Link>
              <form action={logout}>
                <button className="px-2 text-slate-500 hover:text-red-600">خروج</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-outline">
                دخول
              </Link>
              <Link href="/register" className="btn-primary">
                حساب جديد
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
