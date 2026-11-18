import { createHmac, timingSafeEqual } from "node:crypto";

// Kashier signs everything with the merchant's Payment API Key (HMAC-SHA256,
// lowercase hex). Docs: developers.kashier.io/docs/webhooks and
// /docs/direct-api/hashing.

export function kashierApiHost(mode: "test" | "live") {
  return mode === "live" ? "https://api.kashier.io" : "https://test-api.kashier.io";
}

// Order operations (refund, void) live on the FEP host.
export function kashierFepHost(mode: "test" | "live") {
  return mode === "live" ? "https://fep.kashier.io" : "https://test-fep.kashier.io";
}

// Refund reply: a top-level status (SUCCESS, PENDING or FAILURE) with the
// refund transaction under response. Anything else counts as a failure.
export function readKashierRefund(json: unknown): { status: "SUCCESS" | "PENDING" | "FAILURE"; transactionId: string | null; message: string | null } {
  const body = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const response = (body.response && typeof body.response === "object" ? body.response : {}) as Record<string, unknown>;
  const raw = String(response.status ?? body.status ?? "").toUpperCase();
  const status = raw === "SUCCESS" || raw === "PENDING" ? raw : "FAILURE";
  const tx = response.transactionId ?? body.transactionId;
  const messages = body.messages as { ar?: unknown; en?: unknown } | undefined;
  const message = typeof messages?.ar === "string" ? messages.ar : typeof messages?.en === "string" ? messages.en : null;
  return { status, transactionId: typeof tx === "string" && tx ? tx : null, message };
}

// A refund must name the successful "pay" (or "capture") transaction and
// its amount; Kashier answers 500 to a refund without them. Picks it from
// the order lookup's transactions list.
export function kashierPaidTransaction(transactions: unknown): { id: string; amount: number; currency: string } | null {
  if (!Array.isArray(transactions)) return null;
  for (const t of transactions as Record<string, unknown>[]) {
    const op = String(t?.operation ?? "").toLowerCase();
    if ((op === "pay" || op === "capture") && String(t.status ?? "").toUpperCase() === "SUCCESS" &&
        typeof t.transactionId === "string" && t.transactionId && typeof t.amount === "number" && t.amount > 0)
      return { id: t.transactionId, amount: t.amount, currency: typeof t.currency === "string" && t.currency ? t.currency : "EGP" };
  }
  return null;
}

// Kashier sessions take major units with two decimals; orders store piastres.
export function kashierAmount(piastres: number) {
  return (piastres / 100).toFixed(2);
}

function sign(payload: string, key: string) {
  return createHmac("sha256", key).update(payload).digest("hex");
}

function same(expected: string, received: string | null | undefined) {
  if (!received || !/^[a-f0-9]{64}$/i.test(received)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received.toLowerCase(), "hex"));
}

// The `query-string` package Kashier's own Node sample uses also escapes !'()*.
const strictEncode = (v: string) =>
  encodeURIComponent(v).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

// Webhook: the keys listed in data.signatureKeys, sorted, as key=value pairs
// with only the values URL-encoded, joined by "&".
export function kashierWebhookPayloads(data: Record<string, unknown>) {
  const keys = Array.isArray(data.signatureKeys)
    ? data.signatureKeys.filter((k): k is string => typeof k === "string").sort()
    : [];
  const value = (k: string) => {
    const v = data[k];
    return v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  };
  // Kashier's samples disagree on the escaping of a few punctuation marks, so
  // both spellings are accepted; each is still an HMAC over the same fields.
  return [...new Set([encodeURIComponent, strictEncode].map((enc) => keys.map((k) => `${k}=${enc(value(k))}`).join("&")))];
}

export function verifyKashierWebhook(data: Record<string, unknown>, received: string | null, apiKey: string) {
  if (!apiKey || !Array.isArray(data.signatureKeys) || !data.signatureKeys.length) return false;
  return kashierWebhookPayloads(data).some((payload) => same(sign(payload, apiKey), received));
}

// Redirect back to the site: a fixed list of query parameters in this order,
// unencoded; a parameter missing from the redirect is signed as "null".
const REDIRECT_FIELDS = [
  "paymentStatus",
  "cardDataToken",
  "maskedCard",
  "merchantOrderId",
  "orderId",
  "cardBrand",
  "orderReference",
  "transactionId",
  "amount",
  "currency",
] as const;

export function kashierRedirectPayload(query: URLSearchParams) {
  return REDIRECT_FIELDS.map((f) => `${f}=${query.get(f) ?? "null"}`).join("&");
}

export function verifyKashierRedirect(query: URLSearchParams, apiKey: string) {
  if (!apiKey) return false;
  return same(sign(kashierRedirectPayload(query), apiKey), query.get("signature"));
}

export function kashierHmac(payload: string, key: string) {
  return sign(payload, key);
}
