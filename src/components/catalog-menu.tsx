"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

export type CatalogCategory = {
  slug: string;
  name: string;
  icon: string | null;
  count: number;
  children: { slug: string; name: string }[];
};

// The "Catalog" button in the store header: a panel with every top-level
// category and its subcategories. Closes on navigation, Escape or a click
// outside, since the header stays mounted between pages.
export function CatalogMenu({
  label,
  allLabel,
  categories,
}: {
  label: string;
  allLabel: string;
  categories: CatalogCategory[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="btn-primary h-11 px-3 sm:px-4"
      >
        <Icon name="grid" />
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && (
        <div className="card absolute start-0 top-full z-30 mt-2 grid w-[min(92vw,720px)] gap-1 p-3 shadow-xl sm:grid-cols-2">
          {categories.map((c) => (
            <div key={c.slug} className="rounded-xl p-2 hover:bg-slate-50">
              <Link href={`/categories/${c.slug}`} className="flex items-center gap-3 font-semibold">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl">
                  {c.icon}
                </span>
                <span className="flex-1">{c.name}</span>
                <span className="text-xs font-normal text-slate-400">{c.count}</span>
              </Link>
              {c.children.length > 0 && (
                <div className="ms-13 mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                  {c.children.map((s) => (
                    <Link key={s.slug} href={`/categories/${s.slug}`} className="hover:text-brand-600">
                      {s.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link
            href="/search"
            className="flex items-center justify-center gap-1 rounded-xl p-2 text-sm font-semibold text-brand-600 hover:bg-slate-50 sm:col-span-2"
          >
            {allLabel}
            <Icon name="chevron" className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>
      )}
    </div>
  );
}
