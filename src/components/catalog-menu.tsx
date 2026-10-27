"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { CategoryThumb } from "./category-thumb";

export type CatalogCategory = {
  slug: string;
  name: string;
  icon: string | null;
  imageUrl: string | null;
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
        className="btn h-11 bg-brand-600 px-3 text-white hover:bg-brand-500 sm:px-4"
      >
        <Icon name="grid" />
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && (
        <div className="card absolute start-0 top-full z-30 mt-2 grid max-h-[75vh] w-[min(92vw,760px)] gap-1 overflow-y-auto p-3 text-(--color-ink) shadow-xl sm:grid-cols-2">
          {categories.map((c) => (
            <div key={c.slug} className="rounded-xl p-2 hover:bg-slate-50">
              <Link href={`/categories/${c.slug}`} className="flex items-center gap-3 font-semibold">
                <CategoryThumb category={c} className="h-10 w-12 rounded-lg text-xl" />
                <span className="flex-1">{c.name}</span>
                <span className="text-xs font-normal text-slate-400">{c.count}</span>
              </Link>
              {c.children.length > 0 && (
                <div className="ms-15 mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
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
