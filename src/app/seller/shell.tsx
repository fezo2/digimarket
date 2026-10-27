"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Icon, type IconName } from "./icons";

export type ShellLink = {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
  exact?: boolean;
  external?: boolean;
};

// The seller office: a top bar across the page and a sidebar menu that
// slides in from the side on phones.
export function SellerShell({
  brand,
  top,
  links,
  extra,
  children,
}: {
  brand: React.ReactNode;
  top: React.ReactNode;
  links: ShellLink[];
  extra: ShellLink[];
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // Close the drawer after navigating.
  useEffect(() => setOpen(false), [path]);
  const active = (l: ShellLink) =>
    l.exact ? path === l.href : path === l.href || path.startsWith(l.href + "/");
  const item = (l: ShellLink) => {
    const on = !l.external && active(l);
    const cls = `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      on
        ? "bg-slate-100 text-slate-900 font-semibold"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    }`;
    const body = (
      <>
        <Icon name={l.icon} />
        <span className="flex-1">{l.label}</span>
        {!!l.count && (
          <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">
            {l.count > 99 ? "99+" : l.count}
          </span>
        )}
        {l.external && <Icon name="external" className="size-4 opacity-60" />}
      </>
    );
    return l.external ? (
      <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={cls}>
        {body}
      </a>
    ) : (
      <Link key={l.href} href={l.href} className={cls} aria-current={on ? "page" : undefined}>
        {body}
      </Link>
    );
  };
  return (
    <div className="seller-shell min-h-screen overflow-x-clip bg-(--page)">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-1 border-b border-slate-200 bg-(--surface) px-2 sm:gap-3 lg:px-0">
        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label={t("القائمة")}
          aria-expanded={open}
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
        <div className="flex shrink-0 items-center lg:w-64 lg:px-5">{brand}</div>
        {top}
      </header>
      <div className="flex">
        {open && (
          <button
            type="button"
            aria-label={t("إغلاق")}
            className="fixed inset-0 top-16 z-20 bg-black/40 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}
        <aside
          className={`fixed start-0 top-16 bottom-0 z-20 w-64 shrink-0 overflow-y-auto border-e border-slate-200 bg-(--surface) transition-transform lg:sticky lg:h-[calc(100vh-4rem)] ${
            open ? "" : "max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full"
          }`}
        >
          <nav aria-label={t("القائمة")} className="space-y-1 p-3">
            {links.map(item)}
            <hr className="my-3 border-slate-200" />
            {extra.map(item)}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

// A small drop-down: the store menu in the top bar, the "⋯" on table rows.
export function Menu({
  label,
  button,
  children,
  align = "end",
}: {
  label: string;
  button: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  // Fixed position so a menu inside a scrolling table is never clipped.
  const toggle = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) {
      const rtl = document.documentElement.dir === "rtl";
      const atEnd = (align === "end") !== rtl;
      setPos({
        top: r.bottom + 4,
        ...(atEnd ? { right: window.innerWidth - r.right } : { left: r.left }),
      });
    }
    setOpen((o) => !o);
  };
  useEffect(() => {
    if (!open) return;
    const hide = () => setOpen(false);
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", hide, true);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={toggle}
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
      >
        {button}
      </button>
      {open && (
        <div
          style={pos}
          className={`fixed z-40 min-w-52 space-y-0.5 rounded-xl border border-slate-200 bg-(--surface) p-1.5 text-sm shadow-xl [&_a]:flex [&_a]:items-center [&_a]:gap-2 [&_a]:rounded-lg [&_a]:px-3 [&_a]:py-2 [&_a:hover]:bg-slate-100 [&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:gap-2 [&_button]:rounded-lg [&_button]:px-3 [&_button]:py-2 [&_button]:text-start [&_button:hover]:bg-slate-100`}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
