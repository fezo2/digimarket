import { NextResponse } from "next/server";
import { z } from "zod";
import { paymentConfig } from "@/lib/payments/config";
import { verifyKashierWebhook } from "@/lib/payments/kashier";
import { confirmKashierPayment } from "@/lib/payments/kashier-confirm";

export const runtime = "nodejs";

const body = z.object({
  event: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const config = paymentConfig();
  if (config.name !== "kashier") return new NextResponse(null, { status: 404 });
  let parsed: z.infer<typeof body>;
  try {
    const text = await request.text();
    if (text.length > 100000) return new NextResponse(null, { status: 413 });
    parsed = body.parse(JSON.parse(text));
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (
    !verifyKashierWebhook(
      parsed.data,
      request.headers.get("x-kashier-signature"),
      config.apiKey,
    )
  )
    return new NextResponse(null, { status: 401 });
  const { status, merchantOrderId } = parsed.data;
  if (
    status === "SUCCESS" &&
    ["pay", "capture"].includes(parsed.event) &&
    typeof merchantOrderId === "string"
  ) {
    try {
      // Not yet captured (or the lookup failed): answer 500 so Kashier retries.
      if (!(await confirmKashierPayment(merchantOrderId)))
        return new NextResponse(null, { status: 500 });
    } catch (error) {
      console.error(
        "Verified Kashier webhook could not be processed",
        error instanceof Error ? error.name : "UnknownError",
      );
      return new NextResponse(null, { status: 500 });
    }
  }
  return NextResponse.json({ received: true });
}
