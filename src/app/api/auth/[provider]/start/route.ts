import { NextResponse, type NextRequest } from "next/server";
import { currentSite } from "@/lib/auth";
import {
  OAUTH_COOKIE,
  beginOAuth,
  isProvider,
  providerEnabled,
} from "@/lib/oauth";
import { portalOrigin } from "@/lib/oauth-origin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const site = await currentSite();
  // Admin accounts sign in with email and password only.
  if (!isProvider(provider) || !providerEnabled(provider) || site === "admin")
    return new NextResponse("Not found", { status: 404 });
  const origin = portalOrigin(site, req.url);
  const begun = await beginOAuth(
    provider,
    origin,
    site,
    req.nextUrl.searchParams.get("next"),
  );
  const res = NextResponse.redirect(begun.url, 303);
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(OAUTH_COOKIE, begun.cookie, {
    httpOnly: true,
    secure,
    // Apple comes back with a cross-site POST, which drops Lax cookies.
    sameSite: provider === "apple" && secure ? "none" : "lax",
    path: "/api/auth",
    maxAge: begun.maxAge,
  });
  return res;
}
