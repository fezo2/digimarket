import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createSession, currentSite } from "@/lib/auth";
import {
  OAUTH_COOKIE,
  OAuthError,
  appleName,
  finishOAuth,
  isProvider,
  providerEnabled,
  readOAuthState,
  userForIdentity,
  type Provider,
} from "@/lib/oauth";
import { portalOrigin } from "@/lib/oauth-origin";
import { db } from "@/lib/db";
import { SITE_HOME, safeRedirectPath } from "@/lib/sites";

type Params = { params: Promise<{ provider: string }> };

// Google answers with a GET, Apple with a form POST.
export async function GET(req: NextRequest, ctx: Params) {
  return handle(req, ctx, req.nextUrl.searchParams);
}

export async function POST(req: NextRequest, ctx: Params) {
  const form = await req.formData().catch(() => null);
  const values = new URLSearchParams();
  form?.forEach((v, k) => typeof v === "string" && values.set(k, v));
  return handle(req, ctx, values);
}

async function handle(req: NextRequest, { params }: Params, values: URLSearchParams) {
  const { provider } = await params;
  const site = await currentSite();
  if (!isProvider(provider) || !providerEnabled(provider) || site === "admin")
    return new NextResponse("Not found", { status: 404 });
  const origin = portalOrigin(site, req.url);
  const fail = (code: string) => {
    const res = NextResponse.redirect(`${origin}/login?oauth=${code}`, 303);
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
    return res;
  };

  const jar = await cookies();
  const saved = await readOAuthState(
    jar.get(OAUTH_COOKIE)?.value,
    provider,
    values.get("state"),
  );
  // Cancelled at the provider, or the 10 minute window ran out.
  if (values.get("error")) return fail("cancelled");
  const code = values.get("code");
  if (!saved || saved.site !== site || !code || code.length > 2048)
    return fail("expired");

  let result;
  try {
    const identity = await finishOAuth(provider as Provider, code, origin, saved.nonce);
    if (provider === "apple") identity.name ??= appleName(values.get("user"));
    result = await userForIdentity(identity);
  } catch (e) {
    if (e instanceof OAuthError) return fail(e.code);
    console.error(`${provider} sign in failed`, e);
    return fail("failed");
  }

  await createSession({
    userId: result.user.id,
    role: result.user.role,
    sessionVersion: result.user.sessionVersion,
  });
  const next =
    site === "seller" && !(await hasStore(result.user.id))
      ? "/seller/join"
      : safeRedirectPath(saved.next) ?? "/";
  const res = NextResponse.redirect(
    origin + (next === "/" ? SITE_HOME[site] : next),
    303,
  );
  res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
  return res;
}

async function hasStore(userId: string) {
  return !!(await db.sellerProfile.findUnique({ where: { userId }, select: { id: true } }));
}
