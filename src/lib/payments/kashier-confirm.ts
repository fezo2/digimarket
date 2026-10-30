import "server-only";
import { z } from "zod";
import { db } from "../db";
import { markOrderPaid } from "../orders";
import { paymentConfig } from "./config";
import { kashierApiHost } from "./kashier";

const lookup = z.object({
  data: z.array(
    z.object({
      merchantOrderId: z.string(),
      orderId: z.string().min(1),
      status: z.string(),
    }),
  ),
});

// A signed webhook or redirect only says that Kashier sent it; the order is
// marked paid only after Kashier's own order API reports it CAPTURED. The
// session for this order was created server-side with the order's total, and
// Kashier allows one order per reference, so the captured amount is ours.
export async function confirmKashierPayment(orderId: string) {
  const config = paymentConfig();
  if (config.name !== "kashier") return false;
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, total: true, paymentProvider: true },
  });
  if (!order || order.paymentProvider !== "kashier") return false;
  if (order.status === "PAID") return true;
  const response = await fetch(
    `${kashierApiHost(config.mode)}/v3/payment/orders?${new URLSearchParams({ search: order.id })}`,
    {
      headers: { Authorization: config.secretKey },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    console.error("Kashier order lookup failed", { status: response.status });
    return false;
  }
  const match = lookup
    .parse(await response.json())
    .data.find((o) => o.merchantOrderId === order.id);
  if (match?.status !== "CAPTURED") return false;
  await markOrderPaid(order.id, {
    provider: "kashier",
    reference: match.orderId,
    amount: order.total,
  });
  return true;
}
