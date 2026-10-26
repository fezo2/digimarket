import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/session-token";
import { siteForHost, siteForPath, siteOrigins } from "@/lib/sites";

const PROTECTED = ["/account", "/seller", "/admin"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
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
      return guard(req, base, url.pathname, search, NextResponse.rewrite(url));
    }
    const owner = siteForPath(pathname);
    if (owner && owner !== site)
      return NextResponse.redirect(origins[owner] + pathname + search);
  }

  return guard(req, base, pathname, search, NextResponse.next());
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
