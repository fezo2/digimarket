import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { sessionIsCurrent } from "./account-security";
import { isVerified } from "./email-verification";
import { db } from "./db";
import { siteForHost, type Site } from "./sites";
import {
  SESSION_COOKIE as COOKIE,
  authSecret,
  readSessionToken,
  type Session,
} from "./session-token";

const MAX_AGE = 60 * 60 * 24 * 30;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(session: Session) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { sessionVersion: true },
  });
  if (
    session.sessionVersion !== undefined &&
    session.sessionVersion !== user.sessionVersion
  )
    redirect("/login");
  const token = await new SignJWT({
    ...session,
    sessionVersion: user.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(authSecret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession() {
  return readSessionToken((await cookies()).get(COOKIE)?.value);
}

// Loads the user fresh from the database so role changes apply immediately.
// Cached per request: the layout, header and page all ask for it.
export const getCurrentUser = cache(async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { seller: true },
  });
  return user &&
    !user.suspendedAt &&
    sessionIsCurrent(session.sessionVersion, user.sessionVersion)
    ? user
    : null;
});

export async function requireUser(next = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

// Buying and opening a store need a confirmed email.
export async function requireVerifiedUser(next = "/") {
  const user = await requireUser(next);
  if (!isVerified(user))
    redirect(`/verify-email?next=${encodeURIComponent(next)}`);
  return user;
}

// Which portal this request is on: store, seller or admin.
export async function currentSite(): Promise<Site> {
  return siteForHost((await headers()).get("host"));
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  // On the admin host "/" is the admin panel itself, so send them to sign in.
  if (user.role !== "ADMIN")
    redirect((await currentSite()) === "admin" ? "/login" : "/");
  return user;
}

export async function requireSeller() {
  const user = await requireUser("/seller");
  if (!user.seller) redirect("/seller/join");
  return { user, seller: user.seller };
}
