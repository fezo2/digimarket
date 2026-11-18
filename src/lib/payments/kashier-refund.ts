import "server-only";
import { kashierSettings } from "./config";
import { kashierApiHost, kashierFepHost, kashierPaidTransaction, readKashierRefund } from "./kashier";
import { claimGatewayRefund, releaseGatewayRefund, settleGatewayRefund } from "../wallet";

export class GatewayRefundError extends Error {}

// Sends a full refund of a Kashier order back to the buyer's card or wallet.
// The order must already be marked refunded on our side (seller refund,
// dispute or admin refund), which takes the money back from the seller.
export async function refundThroughKashier(actorId: string, orderId: string) {
  const config = kashierSettings();
  if (!config) throw new GatewayRefundError("مفاتيح كاشير مش متظبطة");
  const order = await claimGatewayRefund(actorId, orderId);
  if (!order) throw new GatewayRefundError("الطلب مش مستني استرداد عبر كاشير، أو في استرداد شغال عليه دلوقتي");
  // paymentRef holds Kashier's own order id once the payment is captured.
  if (!order.paymentRef || /^(session:|creating$)/.test(order.paymentRef)) {
    await releaseGatewayRefund(orderId);
    throw new GatewayRefundError("الطلب ده ملوش عملية دفع مسجلة عند كاشير");
  }
  let result: ReturnType<typeof readKashierRefund>;
  try {
    // Kashier needs the paid transaction's id and amount to refund it.
    const lookup = await fetch(
      `${kashierApiHost(config.mode)}/v3/payment/orders?${new URLSearchParams({ search: orderId })}`,
      {
        headers: { Authorization: config.secretKey },
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      },
    );
    if (!lookup.ok) {
      console.error("Kashier order lookup failed", { status: lookup.status });
      throw new Error("Kashier order lookup failed");
    }
    const found = ((await lookup.json()) as { data?: { orderId?: unknown; transactions?: unknown }[] })
      .data?.find((o) => o.orderId === order.paymentRef);
    const paid = kashierPaidTransaction(found?.transactions);
    if (!paid) throw new GatewayRefundError("ملقيناش عملية الدفع عند كاشير. راجع لوحة كاشير");
    const response = await fetch(
      `${kashierFepHost(config.mode)}/v3/orders/${encodeURIComponent(order.paymentRef)}?api-version=2`,
      {
        method: "PUT",
        headers: { Authorization: config.secretKey, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
        // Full refund of the paid transaction (what the Kashier dashboard sends).
        body: JSON.stringify({
          apiOperation: "REFUND",
          reason: (order.refundNote ?? `Order #${order.number}`).slice(0, 200),
          transaction: {
            amount: paid.amount,
            currency: paid.currency,
            targetTransactionId: paid.id,
          },
        }),
      },
    );
    const text = await response.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {}
    result = readKashierRefund(json);
    if (!response.ok || result.status === "FAILURE") {
      console.error("Kashier refund refused", { status: response.status, body: text.slice(0, 500) });
      if (!response.ok && response.status === 401)
        result.message = "كاشير رفض المفتاح: اتأكد إن الـ Secret Key ليه صلاحية الاسترداد";
      throw new GatewayRefundError(result.message ?? "كاشير رفض الاسترداد");
    }
  } catch (error) {
    await releaseGatewayRefund(orderId);
    if (error instanceof GatewayRefundError) throw error;
    console.error("Kashier refund call failed", error instanceof Error ? error.name : "UnknownError");
    throw new GatewayRefundError("مقدرناش نوصل لكاشير. راجع لوحة كاشير قبل ما تجرب تاني عشان متردش مرتين");
  }
  await settleGatewayRefund(
    actorId,
    orderId,
    (result.status === "PENDING" ? "pending:" : "") + (result.transactionId ?? "kashier"),
    order.paidAmount ?? order.total,
  );
  return result.status;
}
