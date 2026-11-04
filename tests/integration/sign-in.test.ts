import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

test("Google/Apple sign in and per-site passwords against PostgreSQL", async (t) => {
  assert.ok(process.env.TEST_DATABASE_URL, "Set TEST_DATABASE_URL");
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.AUTH_SECRET ||= "x".repeat(40);
  process.env.GOOGLE_CLIENT_ID = "google-client";
  process.env.GOOGLE_CLIENT_SECRET = "google-secret";
  const { db } = await import("../../src/lib/db");
  const o = await import("../../src/lib/oauth");
  const acc = await import("../../src/lib/account-security");
  const tools = await import("../../src/lib/seller-tools");
  const key = randomUUID();
  const emails: string[] = [];
  const mail = (n: string) => {
    const e = `${key}-${n}@test.local`;
    emails.push(e);
    return e;
  };
  try {
    await t.test("state cookie round trip", async () => {
      const begun = await o.beginOAuth("google", "https://digiegy.com", "store", "/account");
      const url = new URL(begun.url);
      assert.equal(url.searchParams.get("redirect_uri"), "https://digiegy.com/api/auth/google/callback");
      const state = url.searchParams.get("state")!;
      const saved = await o.readOAuthState(begun.cookie, "google", state);
      assert.equal(saved?.next, "/account");
      assert.equal(saved?.nonce, url.searchParams.get("nonce"));
      assert.equal(await o.readOAuthState(begun.cookie, "google", "other"), null);
      assert.equal(await o.readOAuthState(begun.cookie, "apple", state), null);
      const evil = await o.beginOAuth("google", "https://digiegy.com", "store", "//evil.com");
      const s2 = new URL(evil.url).searchParams.get("state")!;
      assert.equal((await o.readOAuthState(evil.cookie, "google", s2))?.next, null);
    });

    await t.test("new account, then the same identity signs back in", async () => {
      const email = mail("new");
      const id = { provider: "google" as const, subject: key + "-g", email, emailVerified: true, name: "Mona Ali" };
      const first = await o.userForIdentity(id);
      assert.ok(first.created);
      assert.equal(first.user.name, "Mona Ali");
      assert.ok(first.user.emailVerifiedAt);
      // Apple drops the email after the first time: matched by subject.
      const again = await o.userForIdentity({ ...id, email: null, emailVerified: false });
      assert.equal(again.user.id, first.user.id);
      assert.equal(again.created, false);
    });

    await t.test("links to an existing account only with a verified email", async () => {
      const email = mail("old");
      const user = await db.user.create({
        data: { email, name: "Old", passwordHash: await bcrypt.hash("Old-pass#2026", 4) },
      });
      await assert.rejects(
        o.userForIdentity({ provider: "apple", subject: key + "-a", email, emailVerified: false, name: null }),
        /no-email/,
      );
      const linked = await o.userForIdentity({ provider: "apple", subject: key + "-a", email, emailVerified: true, name: null });
      assert.equal(linked.user.id, user.id);
      assert.ok(linked.user.emailVerifiedAt);
      await db.user.update({ where: { id: user.id }, data: { suspendedAt: new Date() } });
      await assert.rejects(
        o.userForIdentity({ provider: "apple", subject: key + "-a", email: null, emailVerified: false, name: null }),
        /suspended/,
      );
    });

    await t.test("each portal keeps its own password", async () => {
      const email = mail("seller");
      const user = await db.user.create({
        data: {
          email,
          name: "Seller",
          role: "ADMIN",
          passwordHash: await bcrypt.hash("Start-pass#2026", 4),
          seller: { create: { storeName: "S " + key, slug: "s-" + key } },
        },
      });
      const ip = key + "-ip";
      for (const site of ["store", "seller", "admin"] as const)
        assert.ok(await acc.authenticate(email, "Start-pass#2026", ip, site));

      await tools.changePassword(user.id, { current: "Start-pass#2026", next: "Store-pass#2026" }, "store");
      assert.ok(await acc.authenticate(email, "Store-pass#2026", ip, "store"));
      assert.equal(await acc.authenticate(email, "Store-pass#2026", ip, "seller"), null);
      assert.ok(await acc.authenticate(email, "Start-pass#2026", ip, "seller"));
      assert.ok(await acc.authenticate(email, "Start-pass#2026", ip, "admin"));

      await tools.changePassword(user.id, { current: "Start-pass#2026", next: "Seller-pass#2026" }, "seller");
      assert.ok(await acc.authenticate(email, "Seller-pass#2026", ip, "seller"));
      assert.ok(await acc.authenticate(email, "Store-pass#2026", ip, "store"));
      assert.ok(await acc.authenticate(email, "Start-pass#2026", ip, "admin"));

      const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      assert.equal(fresh.storeSessionVersion, 1);
      assert.equal(fresh.sellerSessionVersion, 1);
      assert.equal(fresh.adminSessionVersion, 0);
      assert.equal(fresh.sessionVersion, 0);
    });

    await t.test("a reset link only works on the portal it was sent for", async () => {
      const email = mail("reset");
      await db.user.create({
        data: { email, name: "R", passwordHash: await bcrypt.hash("Start-pass#2026", 4) },
      });
      let link = "";
      await acc.requestPasswordReset(email, async (_e, url) => void (link = url), "seller");
      const token = new URL(link).searchParams.get("token")!;
      await assert.rejects(acc.resetPassword(token, "Reset-pass#2026", "store"), /منتهي/);
      await acc.resetPassword(token, "Reset-pass#2026", "seller");
      const ip = key + "-ip2";
      assert.ok(await acc.authenticate(email, "Reset-pass#2026", ip, "seller"));
      assert.ok(await acc.authenticate(email, "Start-pass#2026", ip, "store"));
    });
  } finally {
    await db.user.deleteMany({ where: { email: { in: emails } } });
    await db.$disconnect();
  }
});
