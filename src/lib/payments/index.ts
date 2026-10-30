import "server-only";
import { z } from "zod";
import { db } from "../db";
import { OrderError } from "../orders";
import { paymentConfig, type kashierConfig } from "./config";
import { kashierAmount, kashierApiHost } from "./kashier";

export interface PaymentProvider {
  name: "test" | "paymob" | "manual" | "kashier";
  createPayment(order: {
    id: string;
    number: number;
    total: number;
    buyer: { name: string; email: string; phone?: string | null };
  }): Promise<string>;
}

export function readPaymobIntent(value: string | null) {
  if (!value?.startsWith("intent:")) return null;
  try {
    return z
      .object({ orderId: z.string(), url: z.url() })
      .parse(JSON.parse(value.slice(7)));
  } catch {
    return null;
  }
}

// While a Kashier order awaits payment, paymentRef holds its hosted session.
export function readKashierSession(value: string | null) {
  if (!value?.startsWith("session:")) return null;
  try {
    return z
      .object({ id: z.string(), url: z.url() })
      .parse(JSON.parse(value.slice(8)));
  } catch {
    return null;
  }
}

export function getPaymentProvider(): PaymentProvider {
  const config = paymentConfig();
  if (config.name === "kashier") return kashierProvider(config);
  if (config.name === "manual")
    return {
      name: "manual",
      async createPayment(order) {
        return `/pay/manual/${order.id}`;
      },
    };
  if (config.name === "test")
    return {
      name: "test",
      async createPayment(order) {
        return `/pay/test/${order.id}`;
      },
    };
  return {
    name: "paymob",
    async createPayment(order) {
      const current = await db.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      const existing = readPaymobIntent(current.paymentRef);
      if (
        current.status !== "PENDING_PAYMENT" ||
        current.total !== order.total ||
        current.paymentProvider !== "paymob" ||
        current.expiresAt <= new Date()
      )
        throw new OrderError("الطلب مش متاح للدفع");
      if (existing) return existing.url;
      const claimed = await db.order.updateMany({
        where: {
          id: order.id,
          status: "PENDING_PAYMENT",
          paymentProvider: "paymob",
          paymentRef: null,
          total: order.total,
        },
        data: { paymentRef: "creating" },
      });
      if (!claimed.count)
        throw new OrderError("بنجهّز صفحة الدفع، جرّب تاني بعد لحظة");
      try {
        const [firstName, ...rest] = order.buyer.name.trim().split(/\s+/);
        const response = await fetch(
          "https://accept.paymob.com/v1/intention/",
          {
            method: "POST",
            headers: {
              Authorization: `Token ${config.secret}`,
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({
              amount: order.total,
              currency: "EGP",
              payment_methods: config.integrationIds,
              items: [
                {
                  name: `طلب #${order.number}`,
                  amount: order.total,
                  quantity: 1,
                },
              ],
              billing_data: {
                first_name: firstName || "NA",
                last_name: rest.join(" ") || "NA",
                email: order.buyer.email || "NA",
                phone_number: order.buyer.phone || "NA",
                apartment: "NA",
                street: "NA",
                building: "NA",
                floor: "NA",
                city: "NA",
                country: "NA",
                state: "NA",
              },
              special_reference: order.id,
              notification_url: `${config.appUrl}/api/payments/paymob/webhook`,
              redirection_url: `${config.appUrl}/api/payments/paymob/return`,
            }),
          },
        );
        if (!response.ok) throw new Error("Payment intention request failed");
        const intent = z
          .object({
            client_secret: z.string().min(1),
            intention_order_id: z.number().int().positive(),
          })
          .parse(await response.json());
        const url = `https://accept.paymob.com/unifiedcheckout/?${new URLSearchParams({ publicKey: config.publicKey, clientSecret: intent.client_secret })}`;
        // Bind the HMAC-signed Paymob order.id to this local order. merchant_order_id is not signed.
        const bound = await db.order.updateMany({
          where: {
            id: order.id,
            status: "PENDING_PAYMENT",
            paymentRef: "creating",
          },
          data: {
            paymentRef:
              "intent:" +
              JSON.stringify({
                orderId: String(intent.intention_order_id),
                url,
              }),
          },
        });
        if (!bound.count)
          throw new OrderError("مدة الطلب انتهت، ابدأ طلب جديد");
        return url;
      } catch {
        await db.order.updateMany({
          where: {
            id: order.id,
            status: "PENDING_PAYMENT",
            paymentRef: "creating",
          },
          data: { paymentRef: null },
        });
        throw new OrderError("مش قادرين نفتح صفحة الدفع دلوقتي، جرّب تاني");
      }
    },
  };
}

function kashierProvider(
  config: ReturnType<typeof kashierConfig>,
): PaymentProvider {
  return {
    name: "kashier",
    async createPayment(order) {
      const current = await db.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      if (
        current.status !== "PENDING_PAYMENT" ||
        current.total !== order.total ||
        current.paymentProvider !== "kashier" ||
        current.expiresAt <= new Date()
      )
        throw new OrderError("الطلب مش متاح للدفع");
      // Kashier refuses a second session for the same order reference, so a
      // retry reuses the first one.
      const existing = readKashierSession(current.paymentRef);
      if (existing) return existing.url;
      const claimed = await db.order.updateMany({
        where: {
          id: order.id,
          status: "PENDING_PAYMENT",
          paymentProvider: "kashier",
          paymentRef: null,
          total: order.total,
        },
        data: { paymentRef: "creating" },
      });
      if (!claimed.count)
        throw new OrderError("بنجهّز صفحة الدفع، جرّب تاني بعد لحظة");
      try {
        const response = await fetch(
          `${kashierApiHost(config.mode)}/v3/payment/sessions`,
          {
            method: "POST",
            headers: {
              Authorization: config.secretKey,
              "api-key": config.apiKey,
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({
              merchantId: config.merchantId,
              order: order.id,
              amount: kashierAmount(order.total),
              currency: "EGP",
              paymentType: "credit",
              type: "one-time",
              display: "ar",
              expireAt: current.expiresAt.toISOString(),
              maxFailureAttempts: 3,
              allowedMethods: "card,wallet",
              merchantRedirect: `${config.appUrl}/api/payments/kashier/return`,
              failureRedirect: true,
              serverWebhook: `${config.appUrl}/api/payments/kashier/webhook`,
              description: `طلب #${order.number}`,
              manualCapture: false,
              brandColor: "#6d28d9",
            }),
          },
        );
        if (!response.ok) {
          console.error("Kashier session request failed", {
            status: response.status,
            body: (await response.text()).slice(0, 500),
          });
          throw new Error("Kashier session request failed");
        }
        const session = z
          .object({ _id: z.string().min(1), sessionUrl: z.url() })
          .parse(await response.json());
        if (!session.sessionUrl.startsWith("https://payments.kashier.io/"))
          throw new Error("Unexpected Kashier session URL");
        const bound = await db.order.updateMany({
          where: {
            id: order.id,
            status: "PENDING_PAYMENT",
            paymentRef: "creating",
          },
          data: {
            paymentRef:
              "session:" +
              JSON.stringify({ id: session._id, url: session.sessionUrl }),
          },
        });
        if (!bound.count)
          throw new OrderError("مدة الطلب انتهت، ابدأ طلب جديد");
        return session.sessionUrl;
      } catch (error) {
        await db.order.updateMany({
          where: {
            id: order.id,
            status: "PENDING_PAYMENT",
            paymentRef: "creating",
          },
          data: { paymentRef: null },
        });
        if (error instanceof OrderError) throw error;
        throw new OrderError("مش قادرين نفتح صفحة الدفع دلوقتي، جرّب تاني");
      }
    },
  };
}
