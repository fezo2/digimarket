import test from "node:test";
import assert from "node:assert/strict";
import {
  validateKey,
  uploadSpec,
  checkMagic,
  productImageExt,
} from "../src/lib/storage-rules";
import {
  tokenHash,
  secretMatches,
  securityHeaders,
} from "../src/lib/security";
import { contentSecurityPolicy } from "../src/lib/csp";
import { launchConfig } from "../src/lib/launch-config";
test("private keys reject traversal, absolute paths and unknown prefixes", () => {
  for (const key of [
    "../x",
    "/kyc/u/x.png",
    "C:\\x.png",
    "kyc/../x.png",
    "unknown/u/a.png",
    "pending/u/a.png/extra",
    "chat/u/%2e%2e.png",
  ])
    assert.throws(() => validateKey(key));
  for (const prefix of ["kyc", "products", "chat", "pending"])
    assert.equal(
      validateKey(prefix + "/user-id/abc.png"),
      prefix + "/user-id/abc.png",
    );
});
test("upload kinds enforce size, MIME and file signatures", () => {
  assert.equal(
    uploadSpec("product", 40 * 1024 * 1024, "application/zip"),
    "zip",
  );
  assert.throws(() =>
    uploadSpec("product", 51 * 1024 * 1024, "application/zip"),
  );
  assert.throws(() => uploadSpec("chat", 6 * 1024 * 1024, "image/png"));
  assert.throws(() => uploadSpec("chat", 12, "application/pdf"));
  assert.equal(uploadSpec("receipt", 1024, "image/jpeg"), "jpg");
  assert.throws(() => uploadSpec("receipt", 12, "application/pdf"));
  assert.throws(() => uploadSpec("receipt", 6 * 1024 * 1024, "image/png"));
  assert.equal(
    validateKey("receipts/order1/a-b.png"),
    "receipts/order1/a-b.png",
  );
  assert.throws(() => checkMagic(Buffer.from("<script>"), "image/png"));
  checkMagic(Buffer.from([80, 75, 3, 4]), "application/zip");
  checkMagic(Buffer.from("%PDF-1.4"), "application/pdf");
});
test("secrets compare safely and reset token storage is hashed", () => {
  assert.ok(secretMatches("secret", "secret"));
  assert.ok(!secretMatches("wrong", "secret"));
  assert.ok(!secretMatches(null, undefined));
  assert.match(tokenHash("token"), /^[a-f0-9]{64}$/);
  assert.notEqual(tokenHash("token"), "token");
});
test("production headers deny framing and eval, allow required hosts", () => {
  const headers = securityHeaders({
    NODE_ENV: "production",
    R2_ACCOUNT_ID: "testaccount",
  });
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.ok(headers["Strict-Transport-Security"]);
  const csp = contentSecurityPolicy("abc123", {
    NODE_ENV: "production",
    R2_ACCOUNT_ID: "testaccount",
  });
  assert.ok(!csp.includes("unsafe-eval"));
  const scripts = csp.split("; ").find((d) => d.startsWith("script-src"))!;
  assert.ok(!scripts.includes("unsafe-inline"));
  assert.ok(scripts.includes("'nonce-abc123'"));
  for (const host of [
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "accept.paymob.com",
    "testaccount.r2.cloudflarestorage.com",
  ])
    assert.ok(csp.includes(host));
  assert.ok(
    !securityHeaders({ NODE_ENV: "development" })["Strict-Transport-Security"],
  );
});
test("startup rejects missing production settings and partial optional integrations", () => {
  const env = {
    NODE_ENV: "production",
    AUTH_SECRET: "x".repeat(32),
    APP_URL: "https://example.test",
    STORAGE_DRIVER: "r2",
    CRON_SECRET: "dummy",
    DATABASE_URL: "dummy",
    DIRECT_URL: "dummy",
    R2_ACCOUNT_ID: "dummy",
    R2_ACCESS_KEY_ID: "dummy",
    R2_SECRET_ACCESS_KEY: "dummy",
    R2_BUCKET: "dummy",
    PAYMENT_PROVIDER: "paymob",
    PAYMOB_SECRET_KEY: "dummy",
    PAYMOB_PUBLIC_KEY: "dummy",
    PAYMOB_HMAC_SECRET: "dummy",
    PAYMOB_INTEGRATION_IDS: "1",
  } as NodeJS.ProcessEnv;
  assert.equal(launchConfig(env).driver, "r2");
  for (const key of [
    "AUTH_SECRET",
    "APP_URL",
    "CRON_SECRET",
    "DATABASE_URL",
    "DIRECT_URL",
    "R2_SECRET_ACCESS_KEY",
    "PAYMOB_SECRET_KEY",
  ])
    assert.throws(() => launchConfig({ ...env, [key]: "" }));
  assert.throws(() => launchConfig({ ...env, STORAGE_DRIVER: "local" }));
  assert.throws(() => launchConfig({ ...env, APP_URL: "http://example.test" }));
  assert.throws(() => launchConfig({ ...env, TELEGRAM_BOT_TOKEN: "dummy" }));
  assert.throws(() => launchConfig({ ...env, RESEND_API_KEY: "dummy" }));
});

test("product photos are small images only", () => {
  assert.equal(productImageExt(500 * 1024, "image/webp"), "webp");
  assert.equal(productImageExt(1000, "image/jpeg"), "jpg");
  assert.throws(() => productImageExt(500 * 1024 + 1, "image/png"), /500KB/);
  assert.throws(() => productImageExt(1000, "application/pdf"), /JPG/);
  assert.throws(() => productImageExt(0, "image/png"));
  assert.equal(validateKey("images/seller_1/abc-123.png"), "images/seller_1/abc-123.png");
  assert.throws(() => validateKey("images/../x.png"));
});
