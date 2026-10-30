import { createHmac, timingSafeEqual } from "node:crypto";

// Kashier signs everything with the merchant's Payment API Key (HMAC-SHA256,
// lowercase hex). Docs: developers.kashier.io/docs/webhooks and
// /docs/direct-api/hashing.

export function kashierApiHost(mode: "test" | "live") {
  return mode === "live" ? "https://api.kashier.io" : "https://test-api.kashier.io";
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
