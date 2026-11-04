// Page-number pagination shared by the store, the seller office and the admin.
// Pages are 1-based and come from the `page` query param; anything that is not
// a positive whole number reads as page 1, and a page past the end is clamped
// to the last one so a stale link still shows rows.

export type PageInfo = {
  page: number;
  pages: number;
  perPage: number;
  total: number;
  skip: number;
  take: number;
};

export function pageParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function paginate(total: number, perPage: number, requested: string | number | undefined): PageInfo {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(pages, typeof requested === "number" ? Math.max(1, requested) : pageParam(requested));
  return { page, pages, perPage, total, skip: (page - 1) * perPage, take: perPage };
}

// The page numbers to show around the current one, with null for a gap:
// 1 … 4 5 [6] 7 8 … 20. Short runs show every page.
export function pageWindow(page: number, pages: number, around = 1): (number | null)[] {
  const keep = new Set<number>([1, pages]);
  for (let p = page - around; p <= page + around; p++) if (p >= 1 && p <= pages) keep.add(p);
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const p of sorted) {
    const prev = out.at(-1);
    if (typeof prev === "number" && p - prev === 2) out.push(prev + 1); // a gap of one page is just that page
    else if (typeof prev === "number" && p - prev > 2) out.push(null);
    out.push(p);
  }
  return out;
}

// Query string for a page link: keeps the current filters, drops empty ones,
// and leaves page 1 out so it shares the plain URL.
export function pageHref(
  params: Record<string, string | undefined>,
  page: number,
  opts: { path?: string; param?: string } = {},
) {
  const key = opts.param ?? "page";
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && k !== key) out.set(k, v);
  if (page > 1) out.set(key, String(page));
  const qs = out.toString();
  return `${opts.path ?? ""}${qs ? `?${qs}` : opts.path ? "" : "?"}`;
}
