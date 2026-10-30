import test from "node:test";
import assert from "node:assert/strict";
import { passwordProblem } from "../src/lib/password-policy";
import { corsVerdict } from "../src/lib/cors";
import { securityHeaders } from "../src/lib/security";
import { contentSecurityPolicy } from "../src/lib/csp";

test("weak passwords are refused with a reason", () => {
  for (const weak of [
    "short1!",
    "onlyletters!!",
    "1234567890!",
    "NoSymbol12345",
    "Password123!",
    "!!!!!!!!!!!!",
  ])
    assert.ok(passwordProblem(weak), weak);
  assert.ok(passwordProblem("Mohamed#2026x", "mohamed@x.com"));
  assert.equal(passwordProblem("Blue-river#42"), null);
  assert.equal(passwordProblem("قهوة-الصبح#2026"), null);
});

test("api refuses foreign-origin writes and every preflight", () => {
  const ours = ["https://digiegy.com", "https://seller.digiegy.com"];
  assert.equal(corsVerdict("OPTIONS", "/api/orders/x/file", "https://evil.com", ours), "preflight");
  assert.equal(corsVerdict("POST", "/api/orders/x", "https://evil.com", ours), "forbidden");
  assert.equal(corsVerdict("POST", "/api/orders/x", "https://seller.digiegy.com", ours), "pass");
  assert.equal(corsVerdict("GET", "/api/orders/x/file", "https://evil.com", ours), "pass");
  // Gateways and Telegram post from their own servers.
  assert.equal(corsVerdict("POST", "/api/payments/kashier/webhook", "https://payments.kashier.io", ours), "pass");
  assert.equal(corsVerdict("POST", "/api/telegram/webhook", null, ours), "pass");
  assert.equal(corsVerdict("POST", "/login", "https://evil.com", ours), "pass");
});

test("production headers force HTTPS and lock down embedding", () => {
  const h = securityHeaders({ NODE_ENV: "production" } as NodeJS.ProcessEnv);
  assert.match(h["Strict-Transport-Security"]!, /max-age=63072000/);
  assert.equal(h["X-Frame-Options"], "DENY");
  assert.equal(h["Cross-Origin-Opener-Policy"], "same-origin");
  const csp = contentSecurityPolicy("n", { NODE_ENV: "production" } as NodeJS.ProcessEnv);
  assert.match(csp, /upgrade-insecure-requests/);
  assert.match(csp, /frame-src [^;]*challenges\.cloudflare\.com/);
  assert.doesNotMatch(csp, /unsafe-eval/);
});
