import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { tokenHash } from "./security";
import { passwordProblem } from "./password-policy";
const emailInput = z.string().trim().toLowerCase().email().max(254);
export class AccountError extends Error {}
async function lockKeys(tx: Prisma.TransactionClient, keys: string[]) {
  for (const key of [...keys].sort())
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))::text`;
}
// Counts one attempt for key and says whether it is still within max per window.
export async function withinLimit(key: string, max: number, windowMs: number) {
  key = "limit:" + tokenHash(key);
  return db.$transaction(async (tx) => {
    await lockKeys(tx, [key]);
    const used = await tx.loginAttempt.count({
      where: { key, createdAt: { gte: new Date(Date.now() - windowMs) } },
    });
    if (used >= max) return false;
    await tx.loginAttempt.create({ data: { key } });
    return true;
  });
}
export async function authenticate(
  email: string,
  password: string,
  ip: string,
) {
  email = emailInput.parse(email);
  z.string().max(200).parse(password);
  ip = z.string().max(100).parse(ip);
  const keys = ["login-email:" + tokenHash(email), "login-ip:" + tokenHash(ip)];
  return db.$transaction(
    async (tx) => {
      await lockKeys(tx, keys);
      const since = new Date(Date.now() - 15 * 60000);
      const counts = await Promise.all(
        keys.map((key) =>
          tx.loginAttempt.count({ where: { key, createdAt: { gte: since } } }),
        ),
      );
      if (counts[0] >= 5 || counts[1] >= 20)
        throw new AccountError("محاولات كتير، جرّب بعد شوية");
      const user = await tx.user.findUnique({ where: { email } });
      const valid = user && (await bcrypt.compare(password, user.passwordHash));
      if (!valid) {
        await tx.loginAttempt.createMany({
          data: keys.map((key) => ({ key })),
        });
        return null;
      }
      await tx.loginAttempt.deleteMany({ where: { key: keys[0] } });
      if (user.suspendedAt)
        throw new AccountError(
          "حسابك موقوف من الإدارة" +
            (user.suspendReason ? `: ${user.suspendReason}` : "") +
            ". كلّم الدعم.",
        );
      return user;
    },
    { timeout: 15000 },
  );
}
export function sessionIsCurrent(
  version: number | undefined,
  userVersion: number,
) {
  return version === userVersion;
}
export async function requestPasswordReset(
  email: string,
  deliver: (email: string, url: string) => Promise<void>,
) {
  email = emailInput.parse(email);
  const key = "reset:" + tokenHash(email);
  const token = randomBytes(32).toString("hex");
  const issued = await db.$transaction(async (tx) => {
    await lockKeys(tx, [key]);
    if (
      (await tx.loginAttempt.count({
        where: { key, createdAt: { gte: new Date(Date.now() - 3600000) } },
      })) >= 3
    )
      return false;
    await tx.loginAttempt.create({ data: { key } });
    const user = await tx.user.findUnique({ where: { email } });
    if (!user) return false;
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 30 * 60000),
      },
    });
    return true;
  });
  if (issued) {
    const url = new URL(
      "/reset-password",
      process.env.APP_URL || "http://localhost:3000",
    );
    url.searchParams.set("token", token);
    await deliver(email, url.toString()).catch(() => {
      console.error("Password reset email delivery failed");
    });
  }
}
export async function resetPassword(token: string, password: string) {
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(token);
  const weak = passwordProblem(password);
  if (weak) throw new AccountError(weak);
  const passwordHash = await bcrypt.hash(password, 12);
  return db.$transaction(async (tx) => {
    const target = await tx.passwordResetToken.findUnique({
      where: { tokenHash: tokenHash(token) },
    });
    if (!target) throw new AccountError("اللينك منتهي أو اتستخدم");
    await lockKeys(tx, ["password:" + target.userId]);
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: target.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (!claimed.count) throw new AccountError("اللينك منتهي أو اتستخدم");
    await tx.user.update({
      where: { id: target.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await tx.passwordResetToken.deleteMany({
      where: { userId: target.userId, id: { not: target.id } },
    });
    await tx.sellerProfile.updateMany({
      where: { userId: target.userId, payoutAccount: { not: null } },
      data: { payoutUpdatedAt: new Date() },
    });
  });
}
export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
) {
  const weak = passwordProblem(newPassword);
  if (weak) throw new AccountError(weak);
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.$transaction(async (tx) => {
    await lockKeys(tx, ["password:" + userId]);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(oldPassword, user.passwordHash)))
      throw new AccountError("الباسورد الحالي غلط");
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.sellerProfile.updateMany({
      where: { userId, payoutAccount: { not: null } },
      data: { payoutUpdatedAt: new Date() },
    });
  });
}
export async function deliverResetEmail(email: string, url: string) {
  await sendEmail(
    email,
    "تغيير باسورد ديجي مصر",
    "غيّر الباسورد خلال ٣٠ دقيقة: " + url,
  );
}
export async function sendEmail(to: string, subject: string, text: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`Development email to ${to}: ${subject}\n${text}`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Email delivery failed");
}
