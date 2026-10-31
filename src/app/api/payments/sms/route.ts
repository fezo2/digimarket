import { NextResponse } from "next/server";
import { autoPaymentSettings, handlePaymentNotice } from "@/lib/auto-payments";
import { secretMatches } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 30;

// The platform's phone forwards every InstaPay / wallet SMS or notification
// here (an SMS-forwarder app such as MacroDroid). Accepts JSON, a form, or
// plain text; the shared secret comes in a header or ?key=.
export async function POST(request: Request) {
  const settings = autoPaymentSettings();
  if (!settings.secret) return new NextResponse(null, { status: 404 });
  const url = new URL(request.url);
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const given =
    request.headers.get("x-webhook-secret") ?? bearer ?? url.searchParams.get("key");
  if (!secretMatches(given ?? null, settings.secret))
    return new NextResponse(null, { status: 401 });
  const raw = await request.text();
  if (raw.length > 20000) return new NextResponse(null, { status: 413 });
  let sender: string | undefined = url.searchParams.get("from") ?? undefined;
  let text = "";
  const pick = (o: Record<string, unknown>, keys: string[]) => {
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return undefined;
  };
  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    if (json && typeof json === "object") {
      sender = pick(json, ["from", "sender", "phone", "app", "title"]) ?? sender;
      text =
        [pick(json, ["title"]), pick(json, ["text", "message", "body", "msg", "content", "sms"])]
          .filter(Boolean)
          .join("\n") || "";
    } else text = raw;
  } catch {
    const form = new URLSearchParams(raw);
    const fromForm = ["text", "message", "body", "msg", "content", "sms"]
      .map((k) => form.get(k))
      .find(Boolean);
    if (fromForm) {
      text = fromForm;
      sender = form.get("from") ?? form.get("sender") ?? sender;
    } else text = raw;
  }
  if (!text.trim()) return NextResponse.json({ error: "empty text" }, { status: 400 });
  const result = await handlePaymentNotice({ sender, text });
  return NextResponse.json(result);
}
