"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";
import { OPEN_CATALOG_EVENT } from "./catalog-menu";

type Labels = {
  home: string;
  categories: string;
  search: string;
  account: string;
};

// App-style tab bar pinned to the bottom of the store on phones, so the main
// destinations stay one thumb-tap away however far down the page you are.
export function MobileTabBar({
  labels,
  accountHref,
  accountIcon,
  badge,
}: {
  labels: Labels;
  accountHref: string;
  accountIcon: IconName;
  badge: number;
}) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const tab = (on: boolean) =>
    `relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium ${
      on ? "text-brand-600" : "text-slate-500"
    }`;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-(--surface) pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/0.06)] md:hidden">
      <Link href="/" className={tab(active("/"))}>
        <Icon name="home" className="h-6 w-6" />
        {labels.home}
      </Link>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_CATALOG_EVENT))}
        className={tab(active("/categories"))}
      >
        <Icon name="grid" className="h-6 w-6" />
        {labels.categories}
      </button>
      <Link href="/search" className={tab(active("/search"))}>
        <Icon name="search" className="h-6 w-6" />
        {labels.search}
      </Link>
      <Link href={accountHref} className={tab(active(accountHref))}>
        <Icon name={accountIcon} className="h-6 w-6" />
        {labels.account}
        {badge > 0 && (
          <span className="absolute top-1 start-1/2 ms-2 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 font-bold text-white">
            {badge}
          </span>
        )}
      </Link>
    </nav>
  );
}
