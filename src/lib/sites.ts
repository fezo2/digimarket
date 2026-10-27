// Edge-safe. Splits the app across three hosts: the store (APP_URL), the
// seller portal (SELLER_URL) and the admin panel (ADMIN_URL). With either
// of the last two unset, everything is served from one host as before.

export type Site = "store" | "seller" | "admin";

type Env = Record<string, string | undefined>;

// Pages every host serves for itself: sign-in, uploads and APIs.
const SHARED = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/api",
  "/uploads",
  "/_next",
  "/favicon.ico",
  "/icon.svg",
  // Each host answers for itself: the portals tell crawlers to stay out.
  "/robots.txt",
];

const under = (path: string, prefix: string) =>
  path === prefix || path.startsWith(prefix + "/");

function origin(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function siteOrigins(env: Env = process.env) {
  const seller = origin(env.SELLER_URL);
  const admin = origin(env.ADMIN_URL);
  const store = origin(env.APP_URL);
  if (!seller || !admin || !store) return null;
  return { store, seller, admin } satisfies Record<Site, string>;
}

export function siteForHost(host: string | null, env: Env = process.env): Site {
  const origins = siteOrigins(env);
  if (!origins || !host) return "store";
  const h = host.toLowerCase();
  if (new URL(origins.seller).host === h) return "seller";
  if (new URL(origins.admin).host === h) return "admin";
  return "store";
}

export function isSharedPath(path: string) {
  return SHARED.some((p) => under(path, p));
}

// Which host owns a path; null when every host serves it.
export function siteForPath(path: string): Site | null {
  if (isSharedPath(path)) return null;
  if (under(path, "/seller")) return "seller";
  if (under(path, "/admin")) return "admin";
  return "store";
}

// Home of each portal, used as the default after signing in.
export const SITE_HOME: Record<Site, string> = {
  store: "/",
  seller: "/seller",
  admin: "/admin",
};

// Absolute link to a page on another host, or the bare path when the app
// runs on a single host.
export function siteHref(site: Site, path: string, env: Env = process.env) {
  const origins = siteOrigins(env);
  return origins ? origins[site] + path : path;
}

// Link to the front page of a portal from any host.
export function portalHref(site: Site, env: Env = process.env) {
  const origins = siteOrigins(env);
  return origins ? origins[site] : SITE_HOME[site];
}

// Where to send someone after signing in. Only a path on this same host is
// allowed: anything a browser could read as another origin ("//x", "/\x",
// "https://x", control characters) falls back to the default.
export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  if (!value.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const base = "https://internal.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return null;
    const path = url.pathname + url.search + url.hash;
    return path.startsWith("//") ? null : path;
  } catch {
    return null;
  }
}
