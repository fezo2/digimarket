import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/session-token";
import { PATH_HEADER, siteForHost, siteForPath, siteOrigins } from "@/lib/sites";
import { contentSecurityPolicy } from "@/lib/csp";

const PROTECTED = ["/account", "/seller", "/admin"];

export async function middleware(req: NextRequest) {
  const csp = contentSecurityPolicy(btoa(crypto.randomUUID()));
  const res = await route(req, csp);
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

async function route(req: NextRequest, csp: string) {
  const { pathname, search } = req.nextUrl;
  // Next reads the nonce from the request's CSP and stamps its scripts.
  const request = { headers: new Headers(req.headers) };
  request.headers.set("Content-Security-Policy", csp);
  // Lets the root layout drop the store header inside the seller portal.
  request.headers.set(PATH_HEADER, pathname);
  const origins = siteOrigins();
  // Build redirects from the configured origin, not the internal request URL.
  const base = origins
    ? origins[siteForHost(req.headers.get("host"))]
    : req.url;

  if (origins) {
    const site = siteForHost(req.headers.get("host"));
    // Each portal's root is its dashboard.
    if (site !== "store" && pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = "/" + site;
      request.headers.set(PATH_HEADER, url.pathname);
      return guard(req, base, url.pathname, search, NextResponse.rewrite(url, { request }));
    }
    const owner = siteForPath(pathname);
    if (owner && owner !== site)
      return NextResponse.redirect(origins[owner] + pathname + search);
  }

  return guard(req, base, pathname, search, NextResponse.next({ request }));
}

async function guard(
  req: NextRequest,
  base: string,
  pathname: string,
  search: string,
  pass: NextResponse,
) {
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
    return pass;
  const session = await readSessionToken(
    req.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!session) {
    const url = new URL("/login", base);
    url.searchParams.set("next", req.nextUrl.pathname + search);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && session.role !== "ADMIN")
    return NextResponse.redirect(
      new URL(siteOrigins() ? "/login" : "/", base),
    );
  return pass;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
