import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { secretMatches } from "./security";
import { telegramSend } from "./notifications";
export async function createTelegramLink(sellerId: string) {
  const token = randomBytes(32).toString("hex");
  await db.telegramLinkToken.create({
    data: { token, sellerId, expiresAt: new Date(Date.now() + 15 * 60000) },
  });
  return (
    "https://t.me/" + process.env.TELEGRAM_BOT_USERNAME + "?start=" + token
  );
}
export async function telegramWebhook(
  secret: string | null,
  body: unknown,
  fetcher: typeof fetch = fetch,
) {
  if (!secretMatches(secret, process.env.TELEGRAM_WEBHOOK_SECRET)) return 401;
  const v = z
    .object({
      message: z.object({
        text: z.string(),
        chat: z.object({
          id: z.number().int().positive(),
          type: z.literal("private"),
        }),
      }),
    })
    .safeParse(body);
  if (!v.success) return 200;
  const match = /^\/start ([a-f0-9]{64})$/.exec(v.data.message.text);
  if (!match) return 200;
  const chatId = String(v.data.message.chat.id);
  const linked = await db.$transaction(async (tx) => {
    const claimed = await tx.telegramLinkToken.updateMany({
      where: { token: match[1], usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (!claimed.count) return false;
    const token = await tx.telegramLinkToken.findUniqueOrThrow({
      where: { token: match[1] },
    });
    await tx.sellerProfile.update({
      where: { id: token.sellerId },
      data: { telegramChatId: chatId, telegramLinkedAt: new Date() },
    });
    return true;
  });
  if (linked)
    await telegramSend(chatId, "تم ربط متجرك ✅", fetcher).catch(() => {});
  return 200;
}
