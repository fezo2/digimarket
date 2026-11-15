import "server-only";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import QRCode from "qrcode";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { tokenHash } from "./security";
import { authSecret } from "./session-token";
import { SITE_NAME_EN } from "./config";
import {
  looksLikeTotp,
  matchTotp,
  newBackupCodes,
  newTotpSecret,
  normalizeBackupCode,
  otpauthUrl,
} from "./totp";

// Two-step sign in is optional: any buyer, seller, staff member or admin can
// turn it on from their security settings, and nobody is forced to.

export class TwoFactorError extends Error {}

const WRONG = "الكود غلط";
const TOO_MANY = "محاولات كتير، جرّب بعد ربع ساعة";

export function hashBackupCode(code: string) {
  return tokenHash("2fa-backup:" + normalizeBackupCode(code));
}

// Five wrong codes per 15 minutes per account, on sign in and in settings.
// Only wrong codes count, so normal use never locks anyone out.
const failKey = (userId: string) => "limit:" + tokenHash("2fa-fail:" + userId);
const FAIL_WINDOW = 15 * 60000;

async function attemptAllowed(userId: string) {
  const fails = await db.loginAttempt.count({
    where: { key: failKey(userId), createdAt: { gte: new Date(Date.now() - FAIL_WINDOW) } },
  });
  return fails < 5;
}

async function wrongCode(userId: string): Promise<never> {
  await db.loginAttempt.create({ data: { key: failKey(userId) } });
  throw new TwoFactorError(WRONG);
}

// Checks an authenticator code or an unused backup code and spends it.
// Both updates are conditional, so two requests can't use the same code.
export async function spendSecondFactor(userId: string, code: string) {
  code = String(code ?? "").trim().slice(0, 40);
  if (!code) throw new TwoFactorError("اكتب الكود");
  if (!(await attemptAllowed(userId))) throw new TwoFactorError(TOO_MANY);
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      twoFactorSecret: true,
      twoFactorEnabledAt: true,
      twoFactorLastStep: true,
      twoFactorBackupCodes: true,
    },
  });
  if (!user?.twoFactorEnabledAt || !user.twoFactorSecret)
    throw new TwoFactorError("التحقق بخطوتين مش مفعّل");
  if (looksLikeTotp(code)) {
    const step = matchTotp(user.twoFactorSecret, code, user.twoFactorLastStep);
    if (step === null) return wrongCode(userId);
    const saved = await db.user.updateMany({
      where: {
        id: userId,
        OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: step } }],
      },
      data: { twoFactorLastStep: step },
    });
    if (!saved.count) throw new TwoFactorError(WRONG);
    return { backup: false, backupLeft: user.twoFactorBackupCodes.length };
  }
  const hash = hashBackupCode(code);
  if (!user.twoFactorBackupCodes.includes(hash)) return wrongCode(userId);
  const left = user.twoFactorBackupCodes.filter((c) => c !== hash);
  const saved = await db.user.updateMany({
    where: { id: userId, twoFactorBackupCodes: { has: hash } },
    data: { twoFactorBackupCodes: left },
  });
  if (!saved.count) throw new TwoFactorError(WRONG);
  return { backup: true, backupLeft: left.length };
}

// Step 1 of turning it on: a fresh secret waits until the first code proves
// the app has it.
export async function startTwoFactorSetup(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, twoFactorEnabledAt: true },
  });
  if (user.twoFactorEnabledAt) throw new TwoFactorError("التحقق بخطوتين مفعّل بالفعل");
  const secret = newTotpSecret();
  await db.user.update({
    where: { id: userId },
    data: { twoFactorPendingSecret: secret },
  });
  const url = otpauthUrl(secret, user.email, SITE_NAME_EN);
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, width: 200 });
  return { secret, url, qr };
}

// Step 2: the first code turns it on and hands back the backup codes, shown
// once only.
export async function confirmTwoFactorSetup(userId: string, code: string) {
  if (!(await attemptAllowed(userId))) throw new TwoFactorError(TOO_MANY);
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { twoFactorPendingSecret: true, twoFactorEnabledAt: true },
  });
  if (user.twoFactorEnabledAt) throw new TwoFactorError("التحقق بخطوتين مفعّل بالفعل");
  const secret = user.twoFactorPendingSecret;
  if (!secret) throw new TwoFactorError("ابدأ التفعيل من الأول");
  const step = matchTotp(secret, String(code ?? ""));
  if (step === null) return wrongCode(userId);
  const codes = newBackupCodes();
  const saved = await db.user.updateMany({
    where: { id: userId, twoFactorPendingSecret: secret, twoFactorEnabledAt: null },
    data: {
      twoFactorSecret: secret,
      twoFactorPendingSecret: null,
      twoFactorEnabledAt: new Date(),
      twoFactorLastStep: step,
      twoFactorBackupCodes: codes.map(hashBackupCode),
    },
  });
  if (!saved.count) throw new TwoFactorError("ابدأ التفعيل من الأول");
  return codes;
}

const OFF = {
  twoFactorSecret: null,
  twoFactorPendingSecret: null,
  twoFactorEnabledAt: null,
  twoFactorLastStep: null,
  twoFactorBackupCodes: [],
};

// Turning it off needs a working code, so a stolen cookie alone can't.
export async function disableTwoFactor(userId: string, code: string) {
  await spendSecondFactor(userId, code);
  await db.user.update({ where: { id: userId }, data: OFF });
}

export async function regenerateBackupCodes(userId: string, code: string) {
  await spendSecondFactor(userId, code);
  const codes = newBackupCodes();
  await db.user.update({
    where: { id: userId },
    data: { twoFactorBackupCodes: codes.map(hashBackupCode) },
  });
  return codes;
}

// Lost phone and backup codes: a full admin turns it off after checking ID.
export async function resetTwoFactor(userId: string) {
  await db.user.update({ where: { id: userId }, data: OFF });
}

// Between the password (or Google/Apple) and the code, the browser holds a
// short signed ticket instead of a session.
export const TWO_FACTOR_COOKIE = "dm_2fa";
const TICKET_AGE = 10 * 60;

// Its own key, so a ticket can never pass as a session cookie.
function ticketKey() {
  return createHmac("sha256", authSecret()).update("dm-2fa-ticket").digest();
}

export type TwoFactorTicket = {
  userId: string;
  role: Role;
  sessionVersion: number;
  next: string | null;
};

export async function issueTwoFactorTicket(ticket: TwoFactorTicket) {
  const token = await new SignJWT({ ...ticket, purpose: "2fa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TICKET_AGE}s`)
    .sign(ticketKey());
  (await cookies()).set(TWO_FACTOR_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TICKET_AGE,
  });
}

export async function readTwoFactorTicket(): Promise<TwoFactorTicket | null> {
  const token = (await cookies()).get(TWO_FACTOR_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, ticketKey());
    if (payload.purpose !== "2fa" || typeof payload.userId !== "string")
      return null;
    return {
      userId: payload.userId,
      role: payload.role as Role,
      sessionVersion: Number(payload.sessionVersion),
      next: typeof payload.next === "string" ? payload.next : null,
    };
  } catch {
    return null;
  }
}

export async function clearTwoFactorTicket() {
  (await cookies()).delete(TWO_FACTOR_COOKIE);
}

export function twoFactorOn(user: { twoFactorEnabledAt: Date | null }) {
  return Boolean(user.twoFactorEnabledAt);
}
