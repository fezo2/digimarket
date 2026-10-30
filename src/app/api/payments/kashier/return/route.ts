import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { paymentConfig } from "@/lib/payments/config";
import { verifyKashierRedirect } from "@/lib/payments/kashier";
import { confirmKashierPayment } from "@/lib/payments/kashier-confirm";

// The buyer lands here after Kashier's payment page. The query only says which
// order to show; payment is confirmed with Kashier's API, never from the query.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const config = paymentConfig();
  if (config.name !== "kashier") return new NextResponse(null, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/account", url));
  const id = url.searchParams.get("merchantOrderId");
  const order = id
    ? await db.order.findFirst({
        where: { id, buyerId: user.id, paymentProvider: "kashier" },
        select: { id: true, status: true },
      })
    : null;
  if (!order) return NextResponse.redirect(new URL("/account", url));
  // Confirm now so the buyer gets the code without waiting for the webhook.
  if (
    order.status !== "PAID" &&
    url.searchParams.get("paymentStatus") === "SUCCESS" &&
    verifyKashierRedirect(url.searchParams, config.apiKey)
  )
    await confirmKashierPayment(order.id).catch((error) =>
      console.error(
        "Kashier return confirmation failed",
        error instanceof Error ? error.name : "UnknownError",
      ),
    );
  return NextResponse.redirect(new URL(`/account/orders/${order.id}`, url));
}
