import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readPaymobIntent } from "@/lib/payments";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/account", url));
  const id =
    url.searchParams.get("merchant_order_id") ??
    url.searchParams.get("special_reference");
  const providerOrder = url.searchParams.get("order");
  let order = id
    ? await db.order.findFirst({
        where: { id, buyerId: user.id },
        select: { id: true },
      })
    : (
        await db.order.findMany({
          where: {
            buyerId: user.id,
            paymentProvider: "paymob",
            status: { in: ["PENDING_PAYMENT", "CANCELLED"] },
          },
          select: { id: true, paymentRef: true },
        })
      ).find((o) => readPaymobIntent(o.paymentRef)?.orderId === providerOrder);
  // After the webhook, paymentRef contains the transaction ID instead of the intention.
  // Query parameters identify a page only; they never establish payment success.
  if (!order && !id && url.searchParams.get("id")) {
    order = await db.order.findFirst({
      where: {
        buyerId: user.id,
        paymentProvider: "paymob",
        paymentRef: url.searchParams.get("id")!,
        status: "PAID",
      },
      select: { id: true },
    });
  }
  if (!order) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(new URL(`/account/orders/${order.id}`, url));
}
