import "server-only";
import { db } from "./db";
import { isListed } from "./catalog";
import { sendEmail } from "./account-security";
import { telegramSend } from "./notifications";
import { siteOrigins } from "./sites";
import {
  REMINDER_DEFAULTS,
  clampDelay,
  reminderText,
  unsubscribeLinks,
} from "./checkout-reminder-text";

const SETTINGS_ID = "default";
const WINDOW_MS = 48 * 3600000; // older abandoned checkouts are left alone
const GAP_MS = 24 * 3600000; // at most one reminder per buyer a day

export async function reminderSettings() {
  const row = await db.checkoutReminderSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  return row
    ? { enabled: row.enabled, delayMinutes: row.delayMinutes }
    : REMINDER_DEFAULTS;
}

export async function saveReminderSettings(
  actorId: string,
  input: { enabled: boolean; delayMinutes: number },
) {
  const data = { enabled: input.enabled, delayMinutes: clampDelay(input.delayMinutes) };
  await db.$transaction([
    db.checkoutReminderSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...data },
      update: data,
    }),
    db.auditLog.create({
      data: {
        actorId,
        action: "checkout_reminders.settings",
        targetId: SETTINGS_ID,
        data: JSON.stringify(data),
      },
    }),
  ]);
  return data;
}

export async function setRemindersOff(userId: string, off: boolean) {
  await db.user.update({
    where: { id: userId },
    data: { checkoutRemindersOffAt: off ? new Date() : null },
  });
}

function storeOrigin() {
  return (
    siteOrigins()?.store ?? process.env.APP_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
}

// The newest unpaid order of each buyer who opened checkout, didn't pay, and
// hasn't come back since: no newer order still in progress, no paid order
// after it, no reminder already covering it, none in the last day, and not a
// manual transfer waiting for the admin.
export async function dueReminders(now: Date, delayMinutes: number, limit = 50) {
  const cutoff = new Date(now.getTime() - delayMinutes * 60000);
  const oldest = new Date(now.getTime() - WINDOW_MS);
  const gap = new Date(now.getTime() - GAP_MS);
  return db.$queryRaw<{ id: string }[]>`
    SELECT id FROM (
      SELECT DISTINCT ON (o."buyerId") o.id, o."createdAt"
      FROM "Order" o JOIN "User" u ON u.id = o."buyerId"
      WHERE o.status IN ('PENDING_PAYMENT', 'CANCELLED')
        AND o."reminderSentAt" IS NULL
        AND o."refundedAt" IS NULL
        AND o."createdAt" >= (${oldest}::timestamptz AT TIME ZONE 'UTC')
        AND o."createdAt" <= (${cutoff}::timestamptz AT TIME ZONE 'UTC')
        AND o."expiresAt" < (${now}::timestamptz AT TIME ZONE 'UTC')
        AND u."checkoutRemindersOffAt" IS NULL
        AND u."suspendedAt" IS NULL
        AND NOT EXISTS (SELECT 1 FROM "ManualPayment" m
          WHERE m."orderId" = o.id AND m.status IN ('SUBMITTED', 'CONFIRMED'))
        AND NOT EXISTS (SELECT 1 FROM "Order" p WHERE p."buyerId" = o."buyerId" AND (
          (p."paidAt" IS NOT NULL AND p."createdAt" >= o."createdAt")
          OR p."createdAt" > (${cutoff}::timestamptz AT TIME ZONE 'UTC')
          OR p."reminderSentAt" >= o."createdAt"
          OR p."reminderSentAt" > (${gap}::timestamptz AT TIME ZONE 'UTC')))
      ORDER BY o."buyerId", o."createdAt" DESC
    ) due
    ORDER BY "createdAt"
    LIMIT ${limit}`;
}

type Deps = {
  email: typeof sendEmail;
  telegram: (chatId: string, text: string) => Promise<unknown>;
};

export async function sendCheckoutReminders(
  now = new Date(),
  deps: Deps = { email: sendEmail, telegram: telegramSend },
) {
  const settings = await reminderSettings();
  const secret = process.env.AUTH_SECRET;
  if (!settings.enabled || !secret) return 0;
  const deadline = Date.now() + 20000;
  const origin = storeOrigin();
  let sent = 0;
  for (const { id } of await dueReminders(now, settings.delayMinutes)) {
    if (Date.now() > deadline) break;
    // Claim first, so two overlapping cron runs never send twice.
    const claimed = await db.order.updateMany({
      where: { id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (!claimed.count) continue;
    const order = await db.order.findUniqueOrThrow({
      where: { id },
      select: {
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            seller: { select: { telegramChatId: true } },
          },
        },
        items: {
          select: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                salesEnabled: true,
                seller: { select: { kycStatus: true, salesSuspendedAt: true } },
              },
            },
          },
        },
      },
    });
    const seen = new Set<string>();
    const products = order.items
      .map((i) => i.product)
      .filter((p) => isListed(p) && !seen.has(p.id) && seen.add(p.id))
      .map((p) => ({ title: p.title, url: `${origin}/products/${p.slug}` }));
    // Nothing left to buy: the order stays marked so it isn't picked again.
    if (!products.length) continue;
    const links = unsubscribeLinks(origin, order.buyer.id, secret);
    const text = reminderText({
      name: order.buyer.name,
      products,
      unsubscribeUrl: links.page,
    });
    try {
      await deps.email(order.buyer.email, "لسه طلبك مستنيك على ديجي مصر", text, {
        "List-Unsubscribe": `<${links.oneClick}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      });
    } catch (error) {
      console.error("Checkout reminder email failed", id, error);
      // Let the next run try again.
      await db.order.updateMany({
        where: { id, reminderSentAt: now },
        data: { reminderSentAt: null },
      });
      continue;
    }
    sent++;
    const chatId = order.buyer.seller?.telegramChatId;
    if (chatId)
      await deps
        .telegram(chatId, reminderText({ name: order.buyer.name, products }))
        .catch(() => {});
  }
  return sent;
}

// Reminders sent in the last `days`, and how many of those buyers paid for an
// order within 3 days after the reminder.
export async function reminderStats(days = 7, now = new Date()) {
  const since = new Date(now.getTime() - days * 86400000);
  const [row] = await db.$queryRaw<{ sent: bigint; recovered: bigint }[]>`
    SELECT COUNT(*) AS sent,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Order" p
        WHERE p."buyerId" = o."buyerId" AND p."paidAt" >= o."reminderSentAt"
          AND p."paidAt" < o."reminderSentAt" + INTERVAL '3 days')) AS recovered
    FROM "Order" o
    WHERE o."reminderSentAt" >= (${since}::timestamptz AT TIME ZONE 'UTC')`;
  return { sent: Number(row?.sent ?? 0), recovered: Number(row?.recovered ?? 0) };
}
