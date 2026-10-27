// Date ranges for the seller portal's "Today / 7 days / 30 days / …" tabs.
// Every boundary is a Cairo midnight, because that is the day sellers see.

export const PERIODS = ["all", "today", "yesterday", "7d", "30d", "6m", "range"] as const;
export type PeriodKey = (typeof PERIODS)[number];

export type Period = {
  key: PeriodKey;
  // null = since the beginning.
  from: Date | null;
  to: Date;
  // The equal-length window right before, for "% vs previous period".
  prevFrom: Date | null;
  prevTo: Date | null;
  bucket: "day" | "month";
  // Echoed back into the date inputs.
  fromDay: string;
  toDay: string;
};

const TZ = "Africa/Cairo";
const DAY = 86400000;
const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function wall(at: Date) {
  const p = Object.fromEntries(parts.formatToParts(at).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

// "2026-10-27" for the Cairo calendar day that contains `at`.
export function cairoDay(at: Date) {
  const { y, m, d } = wall(at);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// The UTC instant of Cairo midnight at the start of y-m-d (month is 1-based,
// and day overflow rolls over like Date.UTC does).
export function cairoMidnight(y: number, m: number, d: number) {
  const guess = Date.UTC(y, m - 1, d);
  // Offset of Cairo from UTC around that moment (+2h or +3h in summer).
  const w = wall(new Date(guess));
  const offset = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s) - guess;
  const at = guess - offset;
  // Re-check across a DST switch on that very day.
  const w2 = wall(new Date(at));
  const offset2 = Date.UTC(w2.y, w2.m - 1, w2.d, w2.h, w2.min, w2.s) - at;
  return new Date(guess - offset2);
}

function parseDay(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

export function parsePeriod(
  query: { p?: string; from?: string; to?: string },
  fallback: PeriodKey,
  now = new Date(),
): Period {
  const key = (PERIODS as readonly string[]).includes(query.p ?? "")
    ? (query.p as PeriodKey)
    : fallback;
  const today = wall(now);
  const start = (back: number) => cairoMidnight(today.y, today.m, today.d - back);
  let from: Date | null = null;
  let to = now;
  let bucket: Period["bucket"] = "day";
  switch (key) {
    case "today":
      from = start(0);
      break;
    case "yesterday":
      from = start(1);
      to = start(0);
      break;
    case "7d":
      from = start(6);
      break;
    case "30d":
      from = start(29);
      break;
    case "6m":
      from = cairoMidnight(today.y, today.m - 5, 1);
      bucket = "month";
      break;
    case "range": {
      const a = parseDay(query.from);
      const b = parseDay(query.to);
      from = a ? cairoMidnight(a.y, a.m, a.d) : start(29);
      to = b ? cairoMidnight(b.y, b.m, b.d + 1) : now;
      if (to <= from) to = new Date(from.getTime() + DAY);
      // At most two years in one view.
      if (to.getTime() - from.getTime() > 731 * DAY) from = new Date(to.getTime() - 731 * DAY);
      if (to.getTime() - from.getTime() > 62 * DAY) bucket = "month";
      break;
    }
    case "all":
      bucket = "month";
      break;
  }
  const span = from ? to.getTime() - from.getTime() : 0;
  return {
    key,
    from,
    to,
    prevFrom: from ? new Date(from.getTime() - span) : null,
    prevTo: from,
    bucket,
    fromDay: from ? cairoDay(from) : "",
    toDay: cairoDay(new Date(to.getTime() - 1)),
  };
}

// The day or month slots a chart draws for the period, oldest first; keys
// match cairoDay(x) or cairoDay(x).slice(0, 7).
export function periodSlots(period: Period, firstSale?: Date | null) {
  const from = period.from ?? firstSale ?? period.to;
  const slots: { key: string; start: Date }[] = [];
  const f = wall(from);
  if (period.bucket === "month") {
    for (let i = 0; i < 36; i++) {
      const start = cairoMidnight(f.y, f.m + i, 1);
      if (start >= period.to) break;
      slots.push({ key: cairoDay(start).slice(0, 7), start });
    }
    return slots.slice(-24);
  }
  for (let i = 0; i < 70; i++) {
    const start = cairoMidnight(f.y, f.m, f.d + i);
    if (start >= period.to) break;
    slots.push({ key: cairoDay(start), start });
  }
  return slots;
}

// Change against the previous period, rounded to one decimal; null when
// there is nothing to compare with.
export function percentChange(now: number, before: number) {
  if (!before) return null;
  return Math.round(((now - before) / before) * 1000) / 10;
}

// Query string for links that keep the current filters but change some.
export function withParams(
  current: Record<string, string | undefined>,
  change: Record<string, string | undefined>,
) {
  const merged = { ...current, ...change };
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) out.set(k, v);
  const s = out.toString();
  return s ? `?${s}` : "?";
}
