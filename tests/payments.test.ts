import test from "node:test";
import assert from "node:assert/strict";
import { paymobHmac, verifyPaymobHmac } from "../src/lib/payments/hmac";
import { paymentConfig } from "../src/lib/payments/config";

const sample = {
  amount_cents: 12345,
  created_at: "2026-10-26T12:00:00",
  currency: "EGP",
  error_occured: false,
  has_parent_transaction: false,
  id: 987654,
  integration_id: 321,
  is_3d_secure: true,
  is_auth: false,
  is_capture: false,
  is_refunded: false,
  is_standalone_payment: true,
  is_voided: false,
  order: { id: 123456, merchant_order_id: "our-order" },
  owner: 789,
  pending: false,
  source_data: { pan: "2345", sub_type: "MasterCard", type: "card" },
  success: true,
};
// Independently calculated with Python hmac.new(secret, concatenation, hashlib.sha512).
const expected =
  "63b44e8ee79ed4e48814e7c8adeaef2f7a4e4e6a564a214a9be1dc8e8f671e441a9679469f5a8f3c6463030d66f8b6ad5ba095936b54312fe2ff506ef419c8dc";
test("Paymob HMAC matches a fixed independently computed SHA512 vector", () => {
  assert.equal(paymobHmac(sample, "phase3-known-secret"), expected);
  assert.equal(verifyPaymobHmac(sample, expected, "phase3-known-secret"), true);
  assert.equal(
    verifyPaymobHmac(sample, expected.toUpperCase(), "phase3-known-secret"),
    true,
  );
});
test("tampered signed fields and malformed signatures are rejected", () => {
  assert.equal(
    verifyPaymobHmac(
      { ...sample, amount_cents: 1 },
      expected,
      "phase3-known-secret",
    ),
    false,
  );
  assert.equal(
    verifyPaymobHmac(
      { ...sample, order: { id: 999 } },
      expected,
      "phase3-known-secret",
    ),
    false,
  );
  for (const signature of [null, "", "abc", "x".repeat(128), expected.slice(2)])
    assert.equal(
      verifyPaymobHmac(sample, signature, "phase3-known-secret"),
      false,
    );
  assert.equal(verifyPaymobHmac(sample, expected, "wrong-secret"), false);
});
test("test payments default only in development and are forbidden in production", () => {
  assert.equal(paymentConfig({ NODE_ENV: "development" }).name, "test");
  assert.throws(
    () => paymentConfig({ NODE_ENV: "production", PAYMENT_PROVIDER: "test" }),
    /forbidden/,
  );
  assert.throws(() => paymentConfig({ NODE_ENV: "production" }), /incomplete/);
  assert.throws(() =>
    paymentConfig({ NODE_ENV: "development", PAYMENT_PROVIDER: "unknown" }),
  );
});
test("manual payments need a valid InstaPay address or wallet number", () => {
  const prod = { NODE_ENV: "production", PAYMENT_PROVIDER: "manual" } as const;
  assert.throws(() => paymentConfig(prod), /MANUAL_INSTAPAY or MANUAL_WALLET/);
  assert.deepEqual(
    paymentConfig({ ...prod, MANUAL_INSTAPAY: "digiegy@instapay" }),
    { name: "manual", instapay: "digiegy@instapay", wallet: "" },
  );
  assert.equal(
    paymentConfig({ ...prod, MANUAL_WALLET: "01012345678" }).name,
    "manual",
  );
  assert.throws(
    () => paymentConfig({ ...prod, MANUAL_INSTAPAY: "not an address" }),
    /Invalid MANUAL_INSTAPAY/,
  );
  assert.throws(
    () => paymentConfig({ ...prod, MANUAL_WALLET: "0101234" }),
    /Invalid MANUAL_WALLET/,
  );
  // Hand-typed values are tidied instead of taking the site down.
  assert.deepEqual(
    paymentConfig({
      ...prod,
      MANUAL_INSTAPAY: " Digiegy@InstaPay ",
      MANUAL_WALLET: "+20 101 234 5678",
    }),
    { name: "manual", instapay: "digiegy@instapay", wallet: "01012345678" },
  );
  assert.deepEqual(
    paymentConfig({ ...prod, MANUAL_INSTAPAY: "https://ipn.eg/S/digiegy/instapay/abc" }),
    { name: "manual", instapay: "https://ipn.eg/S/digiegy/instapay/abc", wallet: "" },
  );
});

// Kashier: vectors published in developers.kashier.io (hashing and webhook pages).
import {
  kashierAmount,
  kashierHmac,
  kashierRedirectPayload,
  verifyKashierRedirect,
  verifyKashierWebhook,
} from "../src/lib/payments/kashier";
import { kashierConfig, takesCards } from "../src/lib/payments/config";

test("Kashier order hash matches the documented vector", () => {
  assert.equal(
    kashierHmac("/?payment=mid-0-1.99.20.EGP", "11111"),
    "606a8a1307d64caf4e2e9bb724738f115a8972c27eccb2a8acd9194c357e4bec",
  );
});

const kashierWebhook = {
  amount: 1,
  channel: "online | e-commerce",
  currency: "EGP",
  kashierOrderId: "9ad06b17-755b-4e21-9774-aff3e2726ac9",
  merchantOrderId: "1653481557813",
  method: "card",
  orderReference: "TEST-ORD-38855",
  status: "SUCCESS",
  transactionId: "TX-249893963",
  transactionResponseCode: "00",
  card: { cardInfo: { maskedCard: "511111******1118" } },
  signatureKeys: [
    "transactionResponseCode",
    "amount",
    "channel",
    "currency",
    "kashierOrderId",
    "merchantOrderId",
    "method",
    "orderReference",
    "status",
    "transactionId",
  ],
};
const kashierWebhookSig =
  "9610477b2255b2a8ef84fd89adfaa5f1305ff9c20324205851890f1ea03109f4";

test("Kashier webhook signature matches the documented vector", () => {
  assert.equal(verifyKashierWebhook(kashierWebhook, kashierWebhookSig, "11111"), true);
  assert.equal(
    verifyKashierWebhook(kashierWebhook, kashierWebhookSig.toUpperCase(), "11111"),
    true,
  );
});

test("tampered or unsigned Kashier webhooks are rejected", () => {
  for (const data of [
    { ...kashierWebhook, merchantOrderId: "someone-else" },
    { ...kashierWebhook, status: "FAILURE" },
    { ...kashierWebhook, signatureKeys: [] },
  ])
    assert.equal(verifyKashierWebhook(data, kashierWebhookSig, "11111"), false);
  assert.equal(verifyKashierWebhook(kashierWebhook, kashierWebhookSig, "other"), false);
  assert.equal(verifyKashierWebhook(kashierWebhook, null, "11111"), false);
  assert.equal(verifyKashierWebhook(kashierWebhook, "zz", "11111"), false);
  assert.equal(verifyKashierWebhook(kashierWebhook, kashierWebhookSig, ""), false);
});

test("Kashier redirect signature covers fixed fields with missing ones as null", () => {
  const query = new URLSearchParams({
    paymentStatus: "SUCCESS",
    merchantOrderId: "order-1",
    orderId: "k-1",
    transactionId: "TX-1",
    amount: "120.00",
    currency: "EGP",
    mode: "test",
  });
  assert.equal(
    kashierRedirectPayload(query),
    "paymentStatus=SUCCESS&cardDataToken=null&maskedCard=null&merchantOrderId=order-1&orderId=k-1&cardBrand=null&orderReference=null&transactionId=TX-1&amount=120.00&currency=EGP",
  );
  query.set("signature", kashierHmac(kashierRedirectPayload(query), "key"));
  assert.equal(verifyKashierRedirect(query, "key"), true);
  query.set("merchantOrderId", "order-2");
  assert.equal(verifyKashierRedirect(query, "key"), false);
});

test("Kashier amounts are major units with two decimals", () => {
  assert.equal(kashierAmount(45000), "450.00");
  assert.equal(kashierAmount(12345), "123.45");
});

test("Kashier config requires a merchant ID, both keys and a valid mode", () => {
  const env = {
    NODE_ENV: "test",
    APP_URL: "https://digiegy.test",
    KASHIER_MERCHANT_ID: "MID-123-456",
    KASHIER_API_KEY: "api",
    KASHIER_SECRET_KEY: "secret",
  } as NodeJS.ProcessEnv;
  assert.equal(kashierConfig(env).mode, "test");
  assert.equal(kashierConfig(env).appUrl, "https://digiegy.test");
  assert.equal(paymentConfig({ ...env, PAYMENT_PROVIDER: "kashier" }).name, "kashier");
  assert.throws(() => kashierConfig({ ...env, KASHIER_MERCHANT_ID: "123" }));
  assert.throws(() => kashierConfig({ ...env, KASHIER_SECRET_KEY: "" }));
  assert.throws(() => kashierConfig({ ...env, KASHIER_MODE: "prod" }));
  assert.throws(() =>
    kashierConfig({ ...env, NODE_ENV: "production", APP_URL: "http://digiegy.test" }),
  );
  assert.equal(takesCards({ NODE_ENV: "test", PAYMENT_PROVIDER: "kashier" }), true);
  assert.equal(takesCards({ NODE_ENV: "test", PAYMENT_PROVIDER: "manual" }), false);
});
