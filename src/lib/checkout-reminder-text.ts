import { createHmac, timingSafeEqual } from "node:crypto";

// Pure helpers for abandoned checkout reminders, kept free of the database so
// unit tests can load them.

export const REMINDER_DEFAULTS = { enabled: true, delayMinutes: 60 };
export const MIN_DELAY_MINUTES = 35; // unpaid orders expire after 30 minutes
export const MAX_DELAY_MINUTES = 24 * 60;

// The unsubscribe link carries the user id and an HMAC of it, so it works
// without signing in and can't be forged for someone else.
export function unsubscribeToken(userId: string, secret: string) {
  return createHmac("sha256", secret)
    .update("checkout-reminders:" + userId)
    .digest("hex");
}

export function unsubscribeTokenValid(
  userId: string,
  token: string,
  secret: string | undefined,
) {
  if (!secret || !userId || !/^[a-f0-9]{64}$/.test(token)) return false;
  return timingSafeEqual(
    Buffer.from(unsubscribeToken(userId, secret), "hex"),
    Buffer.from(token, "hex"),
  );
}

export function unsubscribeLinks(origin: string, userId: string, secret: string) {
  const query = new URLSearchParams({
    u: userId,
    t: unsubscribeToken(userId, secret),
  }).toString();
  return {
    page: `${origin}/unsubscribe?${query}`,
    oneClick: `${origin}/api/unsubscribe?${query}`,
  };
}

export function reminderText(v: {
  name: string;
  products: { title: string; url: string }[];
  unsubscribeUrl?: string;
}) {
  const lines = [
    `أهلاً ${v.name}،`,
    "",
    "لاحظنا إنك بدأت تشتري من ديجي مصر ومكمّلتش الدفع.",
    v.products.length > 1
      ? "المنتجات دي لسه متاحة لو حابب تكمّل:"
      : "المنتج ده لسه متاح لو حابب تكمّل:",
    ...v.products.map((p) => `• ${p.title}\n  ${p.url}`),
    "",
    "لو واجهتك مشكلة في الدفع، رد على الرسالة دي أو كلّمنا من صفحة المنتج وهنساعدك.",
  ];
  if (v.unsubscribeUrl)
    lines.push("", "مش عايز رسايل التذكير دي؟ اقفلها من هنا:", v.unsubscribeUrl);
  return lines.join("\n");
}

export function clampDelay(minutes: number) {
  if (!Number.isFinite(minutes)) return REMINDER_DEFAULTS.delayMinutes;
  return Math.min(MAX_DELAY_MINUTES, Math.max(MIN_DELAY_MINUTES, Math.round(minutes)));
}
