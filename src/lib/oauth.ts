import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import {
  SignJWT,
  createRemoteJWKSet,
  importPKCS8,
  jwtVerify,
  type JWTPayload,
} from "jose";
import { db } from "./db";
import { authSecret } from "./session-token";
import { safeRedirectPath, type Site } from "./sites";

// Sign in with Google and Apple (OpenID Connect, authorization code flow).
// Each provider is off until all of its settings are present.

export type Provider = "google" | "apple";
type Env = Record<string, string | undefined>;

// Holds state, nonce and where to go next while the user is at the provider.
export const OAUTH_COOKIE = "dm_oauth";
const STATE_TTL = 10 * 60;

const CONFIG = {
  google: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    jwks: "https://www.googleapis.com/oauth2/v3/certs",
    issuers: ["https://accounts.google.com", "accounts.google.com"],
  },
  apple: {
    authorize: "https://appleid.apple.com/auth/authorize",
    token: "https://appleid.apple.com/auth/token",
    jwks: "https://appleid.apple.com/auth/keys",
    issuers: ["https://appleid.apple.com"],
  },
} as const;

export function isProvider(value: string): value is Provider {
  return value === "google" || value === "apple";
}

export function providerEnabled(provider: Provider, env: Env = process.env) {
  if (provider === "google")
    return !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
  return (
    !!env.APPLE_CLIENT_ID &&
    !!env.APPLE_TEAM_ID &&
    !!env.APPLE_KEY_ID &&
    !!env.APPLE_PRIVATE_KEY
  );
}

export function enabledProviders(env: Env = process.env): Provider[] {
  return (["google", "apple"] as const).filter((p) => providerEnabled(p, env));
}

function clientId(provider: Provider, env: Env = process.env) {
  return provider === "google" ? env.GOOGLE_CLIENT_ID! : env.APPLE_CLIENT_ID!;
}

export function callbackUrl(origin: string, provider: Provider) {
  return `${origin}/api/auth/${provider}/callback`;
}

export type OAuthState = {
  provider: Provider;
  state: string;
  nonce: string;
  next: string | null;
  site: Site;
};

// Starts a sign in: the URL to send the browser to and the signed value to
// keep in the state cookie.
export async function beginOAuth(
  provider: Provider,
  origin: string,
  site: Site,
  next: unknown,
  env: Env = process.env,
) {
  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const url = new URL(CONFIG[provider].authorize);
  url.searchParams.set("client_id", clientId(provider, env));
  url.searchParams.set("redirect_uri", callbackUrl(origin, provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  if (provider === "google") {
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("prompt", "select_account");
  } else {
    // Apple only shares name and email with form_post, a POST from its site.
    url.searchParams.set("scope", "name email");
    url.searchParams.set("response_mode", "form_post");
  }
  const cookie = await new SignJWT({
    provider,
    state,
    nonce,
    next: safeRedirectPath(next),
    site,
  } satisfies OAuthState)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL}s`)
    .sign(authSecret());
  return { url: url.toString(), cookie, maxAge: STATE_TTL };
}

export async function readOAuthState(
  cookie: string | undefined,
  provider: Provider,
  state: string | null,
): Promise<OAuthState | null> {
  if (!cookie || !state) return null;
  try {
    const { payload } = await jwtVerify(cookie, authSecret());
    const saved = payload as unknown as OAuthState;
    if (saved.provider !== provider || saved.state !== state) return null;
    return saved;
  } catch {
    return null;
  }
}

// Apple's client secret is a short-lived JWT signed with the .p8 key.
async function appleClientSecret(env: Env = process.env) {
  const pem = env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: env.APPLE_KEY_ID! })
    .setIssuer(env.APPLE_TEAM_ID!)
    .setSubject(env.APPLE_CLIENT_ID!)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

const jwks = {
  google: createRemoteJWKSet(new URL(CONFIG.google.jwks)),
  apple: createRemoteJWKSet(new URL(CONFIG.apple.jwks)),
};

export type Identity = {
  provider: Provider;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

// Trades the code for tokens and checks the ID token's signature, issuer,
// audience and nonce before trusting anything in it.
export async function finishOAuth(
  provider: Provider,
  code: string,
  origin: string,
  nonce: string,
  env: Env = process.env,
): Promise<Identity> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl(origin, provider),
    client_id: clientId(provider, env),
    client_secret:
      provider === "google"
        ? env.GOOGLE_CLIENT_SECRET!
        : await appleClientSecret(env),
  });
  const res = await fetch(CONFIG[provider].token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10000),
  });
  const tokens = (await res.json().catch(() => ({}))) as { id_token?: string };
  if (!res.ok || !tokens.id_token)
    throw new Error(`${provider} token exchange failed: ${res.status}`);
  const { payload } = await jwtVerify(tokens.id_token, jwks[provider], {
    issuer: [...CONFIG[provider].issuers],
    audience: clientId(provider, env),
  });
  if (payload.nonce !== nonce) throw new Error(`${provider} nonce mismatch`);
  return identityFrom(provider, payload);
}

export function identityFrom(provider: Provider, payload: JWTPayload): Identity {
  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : null;
  // Apple sends "true" as a string.
  const verified = payload.email_verified === true || payload.email_verified === "true";
  return {
    provider,
    subject: String(payload.sub),
    email: email && email.length <= 254 ? email : null,
    emailVerified: verified,
    name: typeof payload.name === "string" ? payload.name : null,
  };
}

// Apple puts the name in a "user" form field, only on the first sign in.
export function appleName(raw: unknown) {
  if (typeof raw !== "string" || raw.length > 2000) return null;
  try {
    const user = JSON.parse(raw) as {
      name?: { firstName?: string; lastName?: string };
    };
    const name = [user.name?.firstName, user.name?.lastName]
      .filter((p) => typeof p === "string" && p.trim())
      .join(" ")
      .trim();
    return name || null;
  } catch {
    return null;
  }
}

export class OAuthError extends Error {
  constructor(public code: "no-email" | "suspended") {
    super(code);
  }
}

function cleanName(name: string | null, email: string) {
  const value = (name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  return value.length >= 2 ? value : email.split("@")[0].slice(0, 80);
}

// Finds the user behind an identity, linking it to an account with the same
// verified email, or creates a new account. New accounts get a random
// password nobody knows; "forgot password" can set a real one.
export async function userForIdentity(identity: Identity) {
  const linked = await db.oAuthAccount.findUnique({
    where: {
      provider_subject: { provider: identity.provider, subject: identity.subject },
    },
    include: { user: true },
  });
  let user = linked?.user ?? null;
  let created = false;
  if (!user) {
    // Only a verified email may claim an existing account.
    if (!identity.email || !identity.emailVerified) throw new OAuthError("no-email");
    const email = identity.email;
    const result = await db.$transaction(async (tx) => {
      let found = await tx.user.findUnique({ where: { email } });
      let isNew = false;
      if (!found) {
        try {
          found = await tx.user.create({
            data: {
              email,
              name: cleanName(identity.name, email),
              passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
              emailVerifiedAt: new Date(),
            },
          });
          isNew = true;
        } catch (e) {
          if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"))
            throw e;
          found = await tx.user.findUniqueOrThrow({ where: { email } });
        }
      } else if (!found.emailVerifiedAt) {
        // The provider just proved they own this inbox.
        found = await tx.user.update({
          where: { id: found.id },
          data: { emailVerifiedAt: new Date() },
        });
      }
      await tx.oAuthAccount.upsert({
        where: {
          provider_subject: { provider: identity.provider, subject: identity.subject },
        },
        create: {
          provider: identity.provider,
          subject: identity.subject,
          email,
          userId: found.id,
        },
        update: {},
      });
      return { user: found, isNew };
    });
    user = result.user;
    created = result.isNew;
  }
  if (user.suspendedAt) throw new OAuthError("suspended");
  return { user, created };
}
