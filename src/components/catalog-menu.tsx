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

// Fired by the mobile bottom bar's "Categories" tab to open this menu.
export const OPEN_CATALOG_EVENT = "dm:open-catalog";

// The "Catalog" button in the store header: a panel with every top-level
// category and its subcategories. Closes on navigation, Escape or a click
// outside, since the header stays mounted between pages. On phones it opens
// as a full-screen sheet with one collapsible row per category.
export function CatalogMenu({
  label,
  allLabel,
  closeLabel,
  categories,
}: {
  label: string;
  allLabel: string;
  closeLabel: string;
  categories: CatalogCategory[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_CATALOG_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CATALOG_EVENT, onOpen);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    // The phone sheet covers the page, so the page behind it must not scroll.
    const phone = window.matchMedia("(max-width: 639px)").matches;
    if (phone) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={label}
        className="btn h-11 bg-brand-600 px-3 text-white hover:bg-brand-500 sm:px-4"
      >
        <Icon name="grid" />
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && (
        <>
          <div className="card absolute start-0 top-full z-30 mt-2 hidden max-h-[75vh] w-[min(92vw,760px)] gap-1 overflow-y-auto p-3 text-(--color-ink) shadow-xl sm:grid sm:grid-cols-2">
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

          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="fixed inset-0 z-50 flex flex-col bg-(--surface) text-(--color-ink) sm:hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-lg font-extrabold">{label}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={closeLabel}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100"
              >
                <Icon name="close" className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-6">
              {categories.map((c) => (
                <details key={c.slug} className="group border-b border-slate-100">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-2 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                    <CategoryThumb category={c} className="h-11 w-11 shrink-0 rounded-xl text-xl" />
                    <span className="flex-1">{c.name}</span>
                    {c.count > 0 && <span className="text-xs font-normal text-slate-400">{c.count}</span>}
                    <Icon name="chevron" className="h-5 w-5 text-slate-400 transition group-open:rotate-90 rtl:rotate-180 rtl:group-open:rotate-90" />
                  </summary>
                  <div className="grid grid-cols-2 gap-2 px-2 pb-4">
                    <Link
                      href={`/categories/${c.slug}`}
                      className="col-span-2 rounded-xl bg-brand-50 px-3 py-2.5 text-sm font-semibold text-brand-700"
                    >
                      {allLabel}: {c.name}
                    </Link>
                    {c.children.map((s) => (
                      <Link
                        key={s.slug}
                        href={`/categories/${s.slug}`}
                        className="truncate rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      >
                        {s.name}
                      </Link>
                    ))}
                  </div>
                </details>
              ))}
              <Link
                href="/search"
                className="mt-3 flex items-center justify-center gap-1 rounded-xl p-3 font-semibold text-brand-600"
              >
                {allLabel}
                <Icon name="chevron" className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
