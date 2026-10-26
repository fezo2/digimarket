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
});
