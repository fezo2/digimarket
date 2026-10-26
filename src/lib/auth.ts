import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { sessionIsCurrent } from "./account-security";
import { db } from "./db";
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
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { seller: true },
  });
  return user && sessionIsCurrent(session.sessionVersion, user.sessionVersion)
    ? user
    : null;
}

export async function requireUser(next = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

export async function requireSeller() {
  const user = await requireUser("/seller");
  if (!user.seller) redirect("/seller/join");
  return { user, seller: user.seller };
}
