import assert from "node:assert/strict";
import test from "node:test";
import {
  base32Decode,
  base32Encode,
  matchTotp,
  newBackupCodes,
  newTotpSecret,
  normalizeBackupCode,
  otpauthUrl,
  totpCode,
} from "../src/lib/totp";
import { canAccess, sellerHome, type SellerAccess } from "../src/lib/seller-staff";

// RFC 6238 appendix B, SHA-1 secret "12345678901234567890" (8-digit vectors
// cut to the 6 digits authenticator apps show).
const RFC = base32Encode(Buffer.from("12345678901234567890"));

test("TOTP matches the RFC 6238 test vectors", () => {
  assert.equal(totpCode(RFC, Math.floor(59 / 30)), "287082");
  assert.equal(totpCode(RFC, Math.floor(1111111109 / 30)), "081804");
  assert.equal(totpCode(RFC, Math.floor(1234567890 / 30)), "005924");
  assert.equal(totpCode(RFC, Math.floor(2000000000 / 30)), "279037");
});

test("base32 round trip and secrets", () => {
  const bytes = Buffer.from([0, 1, 2, 250, 255, 7, 9]);
  assert.deepEqual(base32Decode(base32Encode(bytes)), bytes);
  const secret = newTotpSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.equal(base32Decode(secret).length, 20);
  assert.notEqual(newTotpSecret(), secret);
});

test("codes are accepted one step either side, never replayed", () => {
  const now = 1_700_000_000_000;
  const step = Math.floor(now / 30000);
  const code = totpCode(RFC, step);
  assert.equal(matchTotp(RFC, code, null, now), step);
  assert.equal(matchTotp(RFC, code.slice(0, 3) + " " + code.slice(3), null, now), step);
  assert.equal(matchTotp(RFC, totpCode(RFC, step - 1), null, now), step - 1);
  assert.equal(matchTotp(RFC, totpCode(RFC, step + 1), null, now), step + 1);
  assert.equal(matchTotp(RFC, totpCode(RFC, step - 2), null, now), null);
  // Already used this step.
  assert.equal(matchTotp(RFC, code, step, now), null);
  assert.equal(matchTotp(RFC, "12345", null, now), null);
  assert.equal(matchTotp(RFC, "abcdef", null, now), null);
});

test("backup codes and the otpauth link", () => {
  const codes = newBackupCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const c of codes) assert.match(c, /^[a-z2-9]{4}-[a-z2-9]{4}$/);
  assert.equal(normalizeBackupCode(" AB12-cd34 "), "ab12cd34");
  const url = new URL(otpauthUrl("ABCD", "a@b.com", "Digiegy"));
  assert.equal(url.protocol, "otpauth:");
  assert.equal(url.searchParams.get("secret"), "ABCD");
  assert.equal(url.searchParams.get("issuer"), "Digiegy");
});

test("seller staff areas", () => {
  const seller = {} as SellerAccess["seller"];
  const owner: SellerAccess = { seller, staff: null };
  const support: SellerAccess = { seller, staff: { id: "s", permissions: ["MESSAGES"] } };
  const ops: SellerAccess = { seller, staff: { id: "o", permissions: ["PRODUCTS", "ORDERS"] } };
  assert.equal(canAccess(owner, "OWNER"), true);
  assert.equal(canAccess(owner, "FINANCE"), true);
  assert.equal(canAccess(support, "OWNER"), false);
  assert.equal(canAccess(support, "MESSAGES"), true);
  assert.equal(canAccess(support, "PRODUCTS"), false);
  assert.equal(canAccess(support, ["ORDERS", "FINANCE"]), false);
  assert.equal(canAccess(ops, ["ORDERS", "FINANCE"]), true);
  assert.equal(canAccess(support, "ANY"), true);
  assert.equal(sellerHome(owner), "/seller");
  assert.equal(sellerHome(support), "/seller/messages");
  assert.equal(sellerHome(ops), "/seller");
  assert.equal(sellerHome({ seller, staff: { id: "p", permissions: ["PRODUCTS"] } }), "/seller/products");
});
