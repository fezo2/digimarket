import Link from "next/link";
import { i18n } from "@/lib/prefs";
import { pageHref, pageWindow } from "@/lib/pagination";

type Params = Record<string, string | undefined>;

const chevron = "M9 6l6 6-6 6";

// Page-number navigation used on every long list: the store catalogue, the
// seller office and the admin. Colours come from the theme tokens (slate and
// brand are remapped per site and in dark mode), so it fits all three shells.
//
// Phones get Previous · "3 / 12" · Next; wider screens add the page numbers.
export async function Pager({
  page,
  pages,
  params,
  path,
  param,
  total,
  perPage,
  className = "mt-6",
  compact = false,
}: {
  page: number;
  pages: number;
  params: Params;
  path?: string;
  param?: string;
  total?: number;
  perPage?: number;
  className?: string;
  // Narrow panes (an inbox list) keep the phone layout at every width.
  compact?: boolean;
}) {
  const { t, num } = await i18n();
  if (pages <= 1) return null;
  const href = (p: number) => pageHref(params, p, { path, param });
  const from = perPage ? (page - 1) * perPage + 1 : 0;
  const to = perPage && total !== undefined ? Math.min(total, page * perPage) : 0;

  const wide = (cls: string) => (compact ? "" : cls);
  const box = `inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-xl px-2.5 text-sm font-semibold tabular-nums transition-colors ${wide("sm:h-9 sm:min-w-9")} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`;
  const label = wide("hidden sm:inline");
  const srLabel = compact ? "sr-only" : "sr-only sm:hidden";
  const step = `${box} border border-slate-200 bg-(--surface) text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
  const off = `${box} border border-slate-200 text-slate-400 opacity-50`;

  const arrow = (dir: "prev" | "next") => (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`h-4 w-4 shrink-0 ${dir === "prev" ? "ltr:-scale-x-100" : "rtl:-scale-x-100"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={chevron} />
    </svg>
  );

  return (
    <nav
      aria-label={t("الصفحات")}
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${className}`}
    >
      {total !== undefined && perPage ? (
        <p className="text-sm text-slate-500 tabular-nums">
          {t("{from}–{to} من {total}", { from: num(from), to: num(to), total: num(total) })}
        </p>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link className={step} href={href(page - 1)} rel="prev">
            {arrow("prev")}
            {!compact && <span className={label}>{t("السابق")}</span>}
            <span className={srLabel}>{t("السابق")}</span>
          </Link>
        ) : (
          <span className={off} aria-disabled="true">
            {arrow("prev")}
            {!compact && <span className={label}>{t("السابق")}</span>}
          </span>
        )}

        <span className={`px-2 text-sm font-semibold text-slate-600 tabular-nums ${wide("sm:hidden")}`} aria-current="page">
          {t("{page} / {pages}", { page: num(page), pages: num(pages) })}
        </span>

        {!compact && (
        <span className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, pages).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="w-6 text-center text-slate-400" aria-hidden>
                …
              </span>
            ) : p === page ? (
              <span key={p} aria-current="page" className={`${box} bg-brand-600 text-white`}>
                {num(p)}
              </span>
            ) : (
              <Link
                key={p}
                href={href(p)}
                aria-label={t("صفحة {n}", { n: num(p) })}
                className={`${box} text-slate-700 hover:bg-slate-100`}
              >
                {num(p)}
              </Link>
            ),
          )}
        </span>
        )}

        {page < pages ? (
          <Link className={step} href={href(page + 1)} rel="next">
            {!compact && <span className={label}>{t("التالي")}</span>}
            <span className={srLabel}>{t("التالي")}</span>
            {arrow("next")}
          </Link>
        ) : (
          <span className={off} aria-disabled="true">
            {!compact && <span className={label}>{t("التالي")}</span>}
            {arrow("next")}
          </span>
        )}
      </div>
    </nav>
  );
}
