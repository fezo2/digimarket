import { telegramWebhook } from "@/lib/telegram";
export async function POST(request: Request) {
  let status;
  try {
    status = await telegramWebhook(
      request.headers.get("X-Telegram-Bot-Api-Secret-Token"),
      await request.json().catch(() => null),
    );
  } catch {
    console.error("Telegram webhook processing failed");
    status = 200;
  }
  return new Response(null, { status });
}
