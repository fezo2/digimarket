import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPaymobHmac } from "@/lib/payments/hmac";
import { paymentConfig } from "@/lib/payments/config";
import { readPaymobIntent } from "@/lib/payments";
import { db } from "@/lib/db";
import { markOrderPaid } from "@/lib/orders";

export const runtime = "nodejs";
const callback = z.object({
  id: z.number().int().positive(),
  amount_cents: z.number().int().nonnegative(),
  currency: z.literal("EGP"),
  integration_id: z.number().int(),
  success: z.literal(true),
  pending: z.literal(false),
  is_refunded: z.literal(false),
  is_voided: z.literal(false),
  error_occured: z.literal(false),
  is_auth: z.boolean(),
  is_capture: z.boolean(),
  order: z.object({
    id: z.number().int().positive(),
    merchant_order_id: z.string().min(1),
  }),
});

export async function POST(request: Request) {
  const config = paymentConfig();
  if (config.name !== "paymob") return new NextResponse(null, { status: 404 });
  let obj: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 100000) return new NextResponse(null, { status: 413 });
    obj = z.record(z.string(), z.unknown()).parse(JSON.parse(text).obj);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (
    !verifyPaymobHmac(
      obj,
      new URL(request.url).searchParams.get("hmac"),
      config.hmacSecret,
    )
  )
    return new NextResponse(null, { status: 401 });
  try {
    const parsed = callback.safeParse(obj);
    if (parsed.success) {
      const p = parsed.data;
      if (
        !config.integrationIds.includes(p.integration_id) ||
        (p.is_auth && !p.is_capture)
      )
        return NextResponse.json({ received: true });
      const order = await db.order.findUnique({
        where: { id: p.order.merchant_order_id },
        select: {
          id: true,
          status: true,
          paymentProvider: true,
          paymentRef: true,
        },
      });
      const intent = readPaymobIntent(order?.paymentRef ?? null);
      if (
        order?.status === "PAID" &&
        order.paymentProvider === "paymob" &&
        order.paymentRef === String(p.id)
      )
        return NextResponse.json({ received: true });
      if (
        !order ||
        order.paymentProvider !== "paymob" ||
        intent?.orderId !== String(p.order.id)
      ) {
        console.error(
          "Paymob callback order binding mismatch; admin review required",
          { transactionId: p.id },
        );
      } else
        await markOrderPaid(order.id, {
          provider: "paymob",
          reference: String(p.id),
          amount: p.amount_cents,
        });
    }
  } catch (error) {
    console.error(
      "Verified Paymob callback could not be processed; admin review required",
      error instanceof Error ? error.name : "UnknownError",
    );
  }
  // Valid callbacks are acknowledged even when manual review is necessary.
  return NextResponse.json({ received: true });
}
