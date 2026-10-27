import Link from "next/link";
import { i18n } from "@/lib/prefs";
import { withParams, type Period, type PeriodKey } from "@/lib/seller-period";
import { Icon, type IconName } from "./icons";

type Params = Record<string, string | undefined>;

// Shared building blocks of the seller office pages.

export function Page({ children, wide = true }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto space-y-6 px-4 py-6 lg:px-8 lg:py-8 ${wide ? "max-w-[1400px]" : "max-w-3xl"}`}>
      {children}
    </div>
  );
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="me-auto text-2xl font-bold lg:text-3xl">{title}</h1>
      {children}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`card p-4 lg:p-6 ${className}`}>{children}</section>;
}

const LABELS: Record<PeriodKey, string> = {
  all: "كل الوقت",
  today: "النهارده",
  yesterday: "امبارح",
  "7d": "٧ أيام",
  "30d": "٣٠ يوم",
  "6m": "٦ شهور",
  range: "حسب التاريخ",
};

// "Today · Yesterday · 7 days · 30 days · By date" pills. Other filters in
// `params` are kept when switching.
export async function PeriodTabs({
  period,
  params,
  keys,
}: {
  period: Period;
  params: Params;
  keys: PeriodKey[];
}) {
  const { t } = await i18n();
  const keep = { ...params, p: undefined, from: undefined, to: undefined, page: undefined };
  return (
    <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-2xl bg-(--surface) p-1.5 ring-1 ring-slate-200">
      {keys.map((k) => (
        <Link
          key={k}
          href={withParams(keep, { p: k })}
          className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${
            period.key === k ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {t(LABELS[k])}
        </Link>
      ))}
      <details className="group relative">
        <summary
          className={`flex cursor-pointer list-none items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-semibold ${
            period.key === "range" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {period.key === "range" ? `${period.fromDay} → ${period.toDay}` : t(LABELS.range)}
          <Icon name="chevron" className="size-4 transition group-open:rotate-180" />
        </summary>
        <form className="absolute top-full z-30 mt-2 w-64 space-y-3 rounded-2xl border border-slate-200 bg-(--surface) p-4 shadow-xl max-sm:-start-24">
          {Object.entries(keep).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
          <input type="hidden" name="p" value="range" />
          <label className="label">
            {t("من")}
            <input className="input" type="date" name="from" defaultValue={period.fromDay} required />
          </label>
          <label className="label">
            {t("إلى")}
            <input className="input" type="date" name="to" defaultValue={period.toDay} required />
          </label>
          <button className="btn-primary w-full">{t("عرض")}</button>
        </form>
      </details>
    </div>
  );
}

// Underlined tabs such as "On sale · Stopped · Drafts".
export function Tabs({
  tabs,
  current,
  params,
  name = "tab",
}: {
  tabs: { key: string; label: string; count?: number }[];
  current: string;
  params: Params;
  name?: string;
}) {
  return (
    <div className="flex gap-6 overflow-x-auto border-b border-slate-200 text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={withParams(params, { [name]: tab.key, page: undefined })}
          className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 pb-3 font-semibold ${
            current === tab.key
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{tab.count}</span>
          )}
        </Link>
      ))}
    </div>
  );
}

export async function SearchBox({ value, placeholder }: { value?: string; placeholder: string }) {
  const { t } = await i18n();
  return (
    <div className="relative min-w-56 flex-1 sm:max-w-sm">
      <input className="input pe-10" name="q" defaultValue={value ?? ""} placeholder={placeholder} />
      <button className="absolute inset-y-0 end-0 px-3 text-slate-500 hover:text-slate-900" aria-label={t("بحث")}>
        <Icon name="search" />
      </button>
    </div>
  );
}

export async function Pager({ page, pages, params }: { page: number; pages: number; params: Params }) {
  const { t, num } = await i18n();
  if (pages <= 1) return null;
  const near = [...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages);
  const cls = "grid h-9 min-w-9 place-items-center rounded-xl px-2 text-sm font-semibold";
  return (
    <nav className="flex flex-wrap items-center justify-end gap-1.5" aria-label={t("الصفحات")}>
      {page > 1 && (
        <Link className={`${cls} hover:bg-slate-100`} href={withParams(params, { page: String(page - 1) })}>
          {t("السابق")}
        </Link>
      )}
      {near.map((p, i) => (
        <span key={p} className="contents">
          {i > 0 && p - near[i - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
          <Link
            href={withParams(params, { page: p === 1 ? undefined : String(p) })}
            aria-current={p === page ? "page" : undefined}
            className={`${cls} ${p === page ? "ring-2 ring-brand-500" : "bg-slate-100 hover:bg-slate-200"}`}
          >
            {num(p)}
          </Link>
        </span>
      ))}
      {page < pages && (
        <Link className={`${cls} hover:bg-slate-100`} href={withParams(params, { page: String(page + 1) })}>
          {t("التالي")}
        </Link>
      )}
    </nav>
  );
}

// "+12.5%" / "−72.3%" next to a figure.
export async function Change({ value }: { value: number | null }) {
  const { num } = await i18n();
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-xs font-bold ${
        up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
      dir="ltr"
    >
      <Icon name={up ? "up" : "down"} className="size-3" />
      {up ? "+" : ""}
      {num(value)}%
    </span>
  );
}

export function Kpi({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card p-4 lg:p-5" title={hint}>
      <p className="text-sm text-slate-500">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="text-xl font-bold lg:text-2xl">{value}</p>
        {children}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Empty({
  icon,
  title,
  text,
  children,
}: {
  icon: IconName;
  title: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-brand-600 text-white">
        <Icon name={icon} className="size-8" />
      </span>
      <p className="text-xl font-bold">{title}</p>
      {text && <p className="text-sm text-slate-500">{text}</p>}
      {children}
    </div>
  );
}

const TONES = {
  green: "bg-emerald-50 text-emerald-700",
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
  grey: "bg-slate-100 text-slate-600",
} as const;

export function Pill({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`badge whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
}
