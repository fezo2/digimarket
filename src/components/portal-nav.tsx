"use client";

import { useI18n } from "@/components/i18n-provider";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  count?: number;
  // Exact match only, for a section root like /seller.
  exact?: boolean;
};

export type NavGroup = { title?: string; items: NavItem[] };

// Sidebar on wide screens, a scrolling tab strip on phones.
export function PortalNav({ groups }: { groups: NavGroup[] }) {
  const { t } = useI18n();
  const path = usePathname();
  const active = (i: NavItem) =>
    i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/");
  const items = groups.flatMap((g) => g.items);
  return (
    <>
      <nav
        aria-label={t("القائمة")}
        className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 lg:hidden"
      >
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
              active(i) ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span aria-hidden>{i.icon}</span>
            {i.label}
            {!!i.count && <Count n={i.count} on={active(i)} />}
          </Link>
        ))}
      </nav>
      <aside className="hidden w-60 shrink-0 border-e border-slate-200 bg-white lg:block">
        <nav aria-label={t("القائمة")} className="sticky top-16 space-y-5 p-4">
          {groups.map((g, gi) => (
            <div key={gi} className="space-y-1">
              {g.title && (
                <p className="px-3 pb-1 text-xs font-semibold text-slate-400">{g.title}</p>
              )}
              {g.items.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
                    active(i)
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span aria-hidden className="w-5 text-center">{i.icon}</span>
                  <span className="flex-1">{i.label}</span>
                  {!!i.count && <Count n={i.count} on={false} />}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

function Count({ n, on }: { n: number; on: boolean }) {
  const { num } = useI18n();
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
        on ? "bg-white text-brand-700" : "bg-brand-600 text-white"
      }`}
    >
      {n > 99 ? "99+" : num(n)}
    </span>
  );
}
