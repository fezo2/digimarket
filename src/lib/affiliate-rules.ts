// Edge-safe, pure rules of the affiliate program (also read by the middleware).

// Cookie holding the last affiliate code a visitor arrived with.
export const AFFILIATE_COOKIE = "dm_ref";
// How long a click keeps counting: a purchase within 30 days of it pays.
export const AFFILIATE_COOKIE_DAYS = 30;

// Codes are lower-case latin letters, digits, "-" and "_", 3 to 24 long.
const CODE = /^[a-z0-9][a-z0-9_-]{2,23}$/;
const RESERVED = new Set(["admin", "seller", "digiegy", "support", "test", "null", "undefined"]);

export function normalizeRefCode(value: string | null | undefined) {
  const code = value?.trim().toLowerCase() ?? "";
  return CODE.test(code) ? code : null;
}

export function refCodeProblem(value: string) {
  const code = normalizeRefCode(value);
  if (!code) return "الكود من ٣ لـ ٢٤ حرف إنجليزي أو رقم (ومسموح بـ - و _)";
  if (RESERVED.has(code) || code.startsWith("digiegy")) return "الكود ده محجوز، اختار غيره";
  return null;
}

// Rate for one sale: the store's rate switches the program off for that
// store at 0; otherwise a personal rate beats the store rate, which beats
// the platform default.
export function affiliateRateFor(opts: {
  platformBps: number;
  sellerBps: number | null;
  affiliateBps: number | null;
}) {
  if (opts.sellerBps === 0) return 0;
  return Math.max(0, opts.affiliateBps ?? opts.sellerBps ?? opts.platformBps);
}

// The platform pays the affiliate out of its own commission, so the share
// never exceeds it and the seller's earnings never change.
export function affiliateCommission(total: number, commission: number, bps: number) {
  if (bps <= 0 || total <= 0 || commission <= 0) return 0;
  return Math.min(Math.floor((total * bps) / 10000), commission);
}
