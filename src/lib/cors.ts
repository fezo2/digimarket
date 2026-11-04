// Edge-safe: imported by the middleware.

// Server-to-server callbacks: payment gateways, Telegram and cron call these
// from their own servers and prove themselves with signatures or secrets.
// Apple posts its sign in result from appleid.apple.com; the signed state
// cookie proves it belongs to a sign in this browser started.
const CALLBACKS = [
  "/api/payments/",
  "/api/telegram/",
  "/api/cron/",
  "/api/auth/apple/callback",
];

// CORS policy for /api: no route sends Access-Control-Allow-Origin, so other
// sites can never read our responses. This also refuses preflights and any
// state-changing request a browser sends from a foreign origin.
export function corsVerdict(
  method: string,
  pathname: string,
  origin: string | null,
  allowed: string[],
): "pass" | "preflight" | "forbidden" {
  if (!pathname.startsWith("/api/")) return "pass";
  if (method === "OPTIONS") return "preflight";
  if (method === "GET" || method === "HEAD" || !origin) return "pass";
  if (CALLBACKS.some((p) => pathname.startsWith(p))) return "pass";
  return allowed.includes(origin) ? "pass" : "forbidden";
}
