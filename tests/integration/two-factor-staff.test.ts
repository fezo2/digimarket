import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

test("two-step sign in and seller staff against PostgreSQL", async (t) => {
  assert.ok(process.env.TEST_DATABASE_URL, "Set TEST_DATABASE_URL");
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.AUTH_SECRET ||= "x".repeat(40);
  const { db } = await import("../../src/lib/db");
  const tf = await import("../../src/lib/two-factor");
  const { totpCode, totpStep } = await import("../../src/lib/totp");
  const staffDb = await import("../../src/lib/seller-staff-db");
  const admin = await import("../../src/lib/admin-control");
  const key = randomUUID();
  const ids: string[] = [];
  const user = async (n: string, extra: Record<string, unknown> = {}) => {
    const u = await db.user.create({
      data: { email: `${key}-${n}@test.local`, name: n, passwordHash: "x", ...extra },
    });
    ids.push(u.id);
    return u;
  };
  try {
    await t.test("turn on, sign in with app and backup codes, turn off", async () => {
      const u = await user("tf");
      const setup = await tf.startTwoFactorSetup(u.id);
      assert.match(setup.qr, /<svg/);
      assert.match(setup.url, /^otpauth:\/\/totp\//);
      await assert.rejects(tf.confirmTwoFactorSetup(u.id, "000000"), /الكود غلط/);
      const codes = await tf.confirmTwoFactorSetup(u.id, totpCode(setup.secret, totpStep()));
      assert.equal(codes.length, 10);
      const on = await db.user.findUniqueOrThrow({ where: { id: u.id } });
      assert.ok(on.twoFactorEnabledAt);
      assert.equal(on.twoFactorPendingSecret, null);
      assert.ok(!on.twoFactorBackupCodes.includes(codes[0]));
      // The code that turned it on can't be used again to sign in.
      await assert.rejects(tf.spendSecondFactor(u.id, totpCode(setup.secret, totpStep())), /الكود غلط/);
      const next = await tf.spendSecondFactor(u.id, totpCode(setup.secret, totpStep() + 1));
      assert.equal(next.backup, false);
      const b = await tf.spendSecondFactor(u.id, codes[0].toUpperCase());
      assert.equal(b.backup, true);
      assert.equal(b.backupLeft, 9);
      await assert.rejects(tf.spendSecondFactor(u.id, codes[0]), /الكود غلط/);
      const renewed = await tf.regenerateBackupCodes(u.id, codes[1]);
      await assert.rejects(tf.spendSecondFactor(u.id, codes[2]), /الكود غلط/);
      await tf.disableTwoFactor(u.id, renewed[0]);
      const off = await db.user.findUniqueOrThrow({ where: { id: u.id } });
      assert.equal(off.twoFactorEnabledAt, null);
      assert.equal(off.twoFactorSecret, null);
      assert.deepEqual(off.twoFactorBackupCodes, []);
    });

    await t.test("wrong codes are limited", async () => {
      const u = await user("limit");
      const setup = await tf.startTwoFactorSetup(u.id);
      await tf.confirmTwoFactorSetup(u.id, totpCode(setup.secret, totpStep()));
      for (let i = 0; i < 5; i++)
        await assert.rejects(tf.spendSecondFactor(u.id, "zzzz-zzzz"), /الكود غلط/);
      await assert.rejects(tf.spendSecondFactor(u.id, "zzzz-zzzz"), /محاولات كتير/);
    });

    await t.test("full admin resets it, staff admin can't", async () => {
      const full = await user("full", { role: "ADMIN" });
      const staffAdmin = await user("staffadmin", { role: "ADMIN", adminDataFrom: new Date() });
      const u = await user("lost");
      const setup = await tf.startTwoFactorSetup(u.id);
      await tf.confirmTwoFactorSetup(u.id, totpCode(setup.secret, totpStep()));
      await assert.rejects(admin.resetUserTwoFactor(staffAdmin.id, u.id));
      assert.equal(await admin.resetUserTwoFactor(full.id, u.id), true);
      const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
      assert.equal(after.twoFactorEnabledAt, null);
      assert.equal(after.sessionVersion, u.sessionVersion + 1);
      assert.equal(await admin.resetUserTwoFactor(full.id, u.id), false);
    });

    await t.test("staff: add, rules, chat as the store, remove", async () => {
      const owner = await user("owner", { role: "SELLER" });
      const store = await db.sellerProfile.create({
        data: { userId: owner.id, storeName: "S", slug: `s-${key}` },
      });
      const other = await user("other", { role: "SELLER" });
      await db.sellerProfile.create({
        data: { userId: other.id, storeName: "O", slug: `o-${key}` },
      });
      const emp = await user("emp");
      const buyer = await user("buyer");
      await assert.rejects(staffDb.addStaff(store.id, emp.email, []), /صلاحية/);
      await assert.rejects(staffDb.addStaff(store.id, `${key}-nobody@test.local`, ["ORDERS"]), /مفيش حساب/);
      await assert.rejects(staffDb.addStaff(store.id, owner.email, ["ORDERS"]), /حسابك/);
      await assert.rejects(staffDb.addStaff(store.id, other.email, ["ORDERS"]), /متجر خاص/);
      const s = await staffDb.addStaff(store.id, emp.email.toUpperCase(), ["MESSAGES", "MESSAGES", "BOGUS"]);
      assert.deepEqual(s.permissions, ["MESSAGES"]);
      await assert.rejects(staffDb.addStaff(store.id, emp.email, ["ORDERS"]), /مضاف بالفعل/);

      // Chat: on the store's orders staff act as the owner.
      const category = await db.category.create({
        data: { slug: `c-${key}`, nameAr: "ق", nameEn: "C" },
      });
      const product = await db.product.create({
        data: {
          sellerId: store.id, categoryId: category.id, slug: `p-${key}`,
          title: "P", description: "D", price: 100, deliveryType: "TEXT",
        },
      });
      const order = await db.order.create({
        data: {
          number: Math.floor(Math.random() * 1e9), buyerId: buyer.id,
          subtotal: 100, total: 100, status: "PAID", paidAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          items: {
            create: {
              productId: product.id, sellerId: store.id, title: "P", quantity: 1,
              unitPrice: 100, total: 100, commissionBps: 1000, commissionAmount: 10,
              sellerNet: 90, deliveryType: "TEXT",
            },
          },
        },
      });
      const load = () =>
        db.user.findUniqueOrThrow({
          where: { id: emp.id },
          include: { staffOf: { include: { seller: true } } },
        });
      assert.equal(await staffDb.chatActorId(await load(), order.id), owner.id);
      await staffDb.updateStaff(store.id, s.id, ["ORDERS"]);
      // Without the messages permission they stay themselves.
      assert.equal(await staffDb.chatActorId(await load(), order.id), emp.id);
      await db.order.delete({ where: { id: order.id } });
      await db.product.delete({ where: { id: product.id } });
      await db.category.delete({ where: { id: category.id } });
      assert.equal(await staffDb.chatActorId({ id: buyer.id, staffOf: null }, "x"), buyer.id);

      await staffDb.updateStaff(store.id, s.id, ["PRODUCTS", "FINANCE"]);
      await assert.rejects(staffDb.updateStaff(store.id, "nope", ["PRODUCTS"]), /مش موجود/);
      const before = await db.user.findUniqueOrThrow({ where: { id: emp.id } });
      await staffDb.removeStaff(store.id, s.id);
      const gone = await db.user.findUniqueOrThrow({ where: { id: emp.id }, include: { staffOf: true } });
      assert.equal(gone.staffOf, null);
      assert.equal(gone.sellerSessionVersion, before.sellerSessionVersion + 1);
      await db.sellerProfile.deleteMany({ where: { userId: { in: [owner.id, other.id] } } });
    });
  } finally {
    await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { targetId: { in: ids } }] } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});
