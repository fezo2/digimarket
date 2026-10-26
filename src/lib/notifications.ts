import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { formatEGP } from "./money";
const payloadSchema = z.object({
  orderId: z.string().optional(),
  orderNumber: z.number().int().optional(),
  productId: z.string().optional(),
  title: z.string().max(300).optional(),
  amount: z.number().int().optional(),
});
export type NoticeEvent =
  | "sale"
  | "chat"
  | "dispute.opened"
  | "dispute.resolved"
  | "payout.paid"
  | "payout.rejected"
  | "product.approved"
  | "product.rejected"
  | "stock.low"
  | "sales.suspended"
  | "sales.resumed"
  | "payouts.frozen"
  | "payouts.unfrozen";
const labels: Record<NoticeEvent, string> = {
  sale: "طلب مدفوع جديد",
  chat: "رسالة جديدة على طلب",
  "dispute.opened": "شكوى جديدة على طلب",
  "dispute.resolved": "اتسجل قرار الشكوى",
  "payout.paid": "طلب السحب اتدفع",
  "payout.rejected": "طلب السحب اترفض",
  "product.approved": "المنتج اتوافق عليه",
  "product.rejected": "المنتج اترفض",
  "stock.low": "مخزون المنتج قرب يخلص",
  "sales.suspended": "الإدارة وقفت البيع في متجرك",
  "sales.resumed": "الإدارة رجّعت البيع في متجرك",
  "payouts.frozen": "الإدارة جمّدت السحب من متجرك",
  "payouts.unfrozen": "الإدارة فكّت تجميد السحب",
};
export async function enqueueNotice(
  tx: Prisma.TransactionClient,
  sellerId: string,
  event: NoticeEvent,
  payload: z.input<typeof payloadSchema> = {},
) {
  const seller = await tx.sellerProfile.findUnique({
    where: { id: sellerId },
    select: { telegramChatId: true, telegramLinkedAt: true },
  });
  if (!seller?.telegramChatId || !seller.telegramLinkedAt) return;
  await tx.notification.create({
    data: {
      sellerId,
      event,
      payload: JSON.stringify(payloadSchema.parse(payload)),
    },
  });
}
export function noticeText(event: NoticeEvent, raw: string) {
  const p = payloadSchema.parse(JSON.parse(raw));
  const path = p.orderId
    ? "/seller/sales/" + encodeURIComponent(p.orderId)
    : p.productId
      ? "/seller/products/" + encodeURIComponent(p.productId)
      : "/seller/wallet";
  return [
    labels[event],
    p.orderNumber ? "#" + p.orderNumber : "",
    p.title || "",
    p.amount === undefined ? "" : formatEGP(p.amount),
    (process.env.SELLER_URL || process.env.APP_URL || "").replace(/\/$/, "") +
      path,
  ]
    .filter(Boolean)
    .join("\n");
}
export async function telegramSend(
  chatId: string,
  text: string,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(
    "https://api.telegram.org/bot" +
      process.env.TELEGRAM_BOT_TOKEN +
      "/sendMessage",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  const result = await response.json().catch(() => ({ ok: false }));
  return {
    ok: response.ok && result.ok === true,
    blocked: response.status === 403 || result.error_code === 403,
  };
}
export async function sendNotifications(
  fetcher: typeof fetch = fetch,
  budgetMs = 25000,
) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return 0;
  const deadline = Date.now() + Math.min(budgetMs, 25000);
  let count = 0;
  while (count < 100 && Date.now() + 17000 < deadline) {
    const found = await db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM "Notification" WHERE status='PENDING' AND "nextAttemptAt" <= (NOW() AT TIME ZONE 'UTC') ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
        if (!rows.length) return false;
        const n = await tx.notification.findUniqueOrThrow({
          where: { id: rows[0].id },
        });
        const seller = await tx.sellerProfile.findUnique({
          where: { id: n.sellerId },
        });
        if (!seller?.telegramChatId || !seller.telegramLinkedAt) {
          await tx.notification.update({
            where: { id: n.id },
            data: { status: "FAILED", lastError: "unlinked" },
          });
          return true;
        }
        let result = { ok: false, blocked: false };
        try {
          result = await telegramSend(
            seller.telegramChatId,
            noticeText(n.event as NoticeEvent, n.payload),
            fetcher,
          );
        } catch {
          /* Never persist transport exceptions: they can contain bot tokens. */
        }
        const attempts = n.attempts + 1;
        if (result.blocked)
          await tx.sellerProfile.updateMany({
            where: { id: seller.id, telegramChatId: seller.telegramChatId },
            data: { telegramChatId: null, telegramLinkedAt: null },
          });
        await tx.notification.updateMany({
          where: { id: n.id, status: "PENDING" },
          data: result.ok
            ? { status: "SENT", sentAt: new Date(), attempts, lastError: null }
            : {
                attempts,
                status: result.blocked || attempts >= 5 ? "FAILED" : "PENDING",
                lastError: result.blocked ? "blocked" : "delivery_failed",
                nextAttemptAt: new Date(
                  Date.now() + ([1, 5, 30, 120][attempts - 1] || 120) * 60000,
                ),
              },
        });
        return true;
      },
      { timeout: 15000 },
    );
    if (!found) break;
    count++;
  }
  return count;
}
