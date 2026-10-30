import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

test("sign-up email codes against PostgreSQL", async (t) => {
  assert.ok(process.env.TEST_DATABASE_URL, "Set TEST_DATABASE_URL");
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.AUTH_SECRET ||= "x".repeat(40);
  const { db } = await import("../../src/lib/db");
  const s = await import("../../src/lib/signup");
  const email = `${randomUUID()}@test.local`;
  const codes: string[] = [];
  const deliver = async (_to: string, _subject: string, text: string) => {
    codes.push(text.match(/\b\d{6}\b/)![0]);
  };
  const wrong = () => (codes.at(-1) === "000000" ? "111111" : "000000");
  try {
    await t.test("no user exists until the code is entered", async () => {
      const id = await s.startSignup(
        { name: "مشتري", email, password: "Blue-river#42", next: "/account" },
        deliver,
      );
      assert.equal(await db.user.count({ where: { email } }), 0);
      const row = await db.pendingSignup.findUniqueOrThrow({ where: { id } });
      assert.ok(!row.codeHash.includes(codes[0]));
      assert.ok(!row.passwordHash.includes("Blue-river"));
      assert.equal(await s.completeSignup(id, wrong()), null);
      assert.equal(await db.user.count({ where: { email } }), 0);
      const done = await s.completeSignup(id, codes[0]);
      assert.ok(done);
      assert.equal(done.next, "/account");
      assert.ok(done.user.emailVerifiedAt);
      assert.equal(await db.pendingSignup.count({ where: { email } }), 0);
      await assert.rejects(s.completeSignup(id, codes[0]), /انتهى/);
      await assert.rejects(
        s.startSignup({ name: "x", email, password: "Blue-river#42" }, deliver),
        /مسجّل/,
      );
    });

    await t.test("wrong codes lock after 5 tries until a new code", async () => {
      await db.user.deleteMany({ where: { email } });
      const id = await s.startSignup({ name: "x", email, password: "Blue-river#42" }, deliver);
      for (let i = 0; i < 5; i++) assert.equal(await s.completeSignup(id, wrong()), null);
      await assert.rejects(s.completeSignup(id, codes.at(-1)!), /كتير/);
      await s.resendSignupCode(id, deliver);
      assert.ok(await s.completeSignup(id, codes.at(-1)!));
    });

    await t.test("expired codes fail", async () => {
      await db.user.deleteMany({ where: { email } });
      const id = await s.startSignup({ name: "x", email, password: "Blue-river#42" }, deliver);
      await db.pendingSignup.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1) } });
      await assert.rejects(s.completeSignup(id, codes.at(-1)!), /انتهى/);
      assert.equal(await s.pendingSignup(id), null);
    });
  } finally {
    await db.pendingSignup.deleteMany({ where: { email } });
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  }
});
