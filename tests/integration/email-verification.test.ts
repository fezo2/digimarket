import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

test("email verification against PostgreSQL", async (t) => {
  assert.ok(process.env.TEST_DATABASE_URL, "Set TEST_DATABASE_URL");
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.RESEND_API_KEY = "test";
  process.env.EMAIL_FROM = "no-reply@digiegy.test";
  const { db } = await import("../../src/lib/db");
  const v = await import("../../src/lib/email-verification");
  const key = randomUUID();
  const user = await db.user.create({
    data: { email: `${key}@test.local`, name: "مشتري", passwordHash: "test" },
  });
  try {
    const links: string[] = [];
    const deliver = async (_to: string, _s: string, text: string) => {
      links.push(text.match(/https?:\/\/\S+/)![0]);
    };

    await t.test("new accounts start unverified", () => {
      assert.equal(user.emailVerifiedAt, null);
      assert.equal(v.isVerified(user), false);
    });

    await t.test("link verifies once and stores only a hash", async () => {
      assert.equal(await v.sendVerificationEmail(user, "https://digiegy.com", deliver), "sent");
      const token = new URL(links[0]).searchParams.get("token")!;
      const row = await db.emailVerificationToken.findFirstOrThrow({ where: { userId: user.id } });
      assert.notEqual(row.tokenHash, token);
      assert.equal(await v.verifyEmail("bad"), null);
      assert.equal(await v.verifyEmail(token), user.id);
      assert.equal(await v.verifyEmail(token), null);
      const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      assert.ok(fresh.emailVerifiedAt);
      assert.equal(await v.sendVerificationEmail(fresh, "https://digiegy.com", deliver), "verified");
    });

    await t.test("expired links fail and resends are capped", async () => {
      await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: null } });
      const u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      assert.equal(await v.sendVerificationEmail(u, "https://digiegy.com", deliver), "sent");
      const token = new URL(links.at(-1)!).searchParams.get("token")!;
      await db.emailVerificationToken.updateMany({
        where: { userId: user.id },
        data: { expiresAt: new Date(Date.now() - 1) },
      });
      assert.equal(await v.verifyEmail(token), null);
      assert.equal(await v.sendVerificationEmail(u, "https://digiegy.com", deliver), "sent");
      assert.equal(await v.sendVerificationEmail(u, "https://digiegy.com", deliver), "limited");
    });
  } finally {
    await db.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
