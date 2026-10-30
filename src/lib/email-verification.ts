import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { tokenHash } from "./security";
import { sendEmail, withinLimit } from "./account-security";
import { siteOrigins, type Site } from "./sites";

const LINK_TTL = 24 * 3600000;

// Always on in production: a missing email provider then shows up as a
// failed send instead of silently letting unconfirmed sign-ups through.
// In development it only runs when an email provider is configured.
export function verificationRequired(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === "production" || (!!env.RESEND_API_KEY && !!env.EMAIL_FROM);
}

export function isVerified(user: { emailVerifiedAt: Date | null }) {
  return !!user.emailVerifiedAt || !verificationRequired();
}

// The link opens on the host the user signed up on, so a seller lands back
// in the seller portal.
export function verificationOrigin(site: Site, env: NodeJS.ProcessEnv = process.env) {
  return siteOrigins(env)?.[site] ?? env.APP_URL ?? "http://localhost:3000";
}

export async function sendVerificationEmail(
  user: { id: string; email: string; emailVerifiedAt: Date | null },
  origin: string,
  deliver: (to: string, subject: string, text: string) => Promise<void> = sendEmail,
) {
  if (user.emailVerifiedAt) return "verified" as const;
  if (!(await withinLimit("verify-email:" + user.id, 3, 3600000)))
    return "limited" as const;
  const token = randomBytes(32).toString("hex");
  await db.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + LINK_TTL),
    },
  });
  const url = new URL("/verify-email", origin);
  url.searchParams.set("token", token);
  await deliver(
    user.email,
    "أكّد إيميلك على ديجي مصر",
    "أهلاً بيك في ديجي مصر.\nافتح اللينك ده عشان تأكد إيميلك (شغال ٢٤ ساعة):\n" +
      url +
      "\n\nلو انت ماعملتش حساب، تجاهل الرسالة دي.",
  );
  return "sent" as const;
}

// Any live link for the user verifies them; all their links then die.
export async function verifyEmail(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return db.$transaction(async (tx) => {
    const row = await tx.emailVerificationToken.findUnique({
      where: { tokenHash: tokenHash(token) },
    });
    if (!row || row.expiresAt <= new Date()) return null;
    await tx.emailVerificationToken.deleteMany({ where: { userId: row.userId } });
    await tx.user.updateMany({
      where: { id: row.userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
    return row.userId;
  });
}
