import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

test("seller tools against PostgreSQL", async (t) => {
  assert.ok(process.env.TEST_DATABASE_URL, "Set TEST_DATABASE_URL");
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const { db } = await import("../../src/lib/db");
  const tools = await import("../../src/lib/seller-tools");
  const { createOrder, markOrderPaid } = await import("../../src/lib/orders");
  const key = randomUUID();
  const users: string[] = [];
  let categoryId = "";
  try {
    const buyer = await db.user.create({
      data: {
        email: `${key}-buyer@test.local`,
        name: "مشتري",
        passwordHash: await bcrypt.hash("old-password", 4),
      },
    });
    users.push(buyer.id);
    const sellerUser = await db.user.create({
      data: {
        email: `${key}-seller@test.local`,
        name: "تاجر",
        passwordHash: "test-only",
        role: "SELLER",
        seller: {
          create: { storeName: "متجر", slug: key, type: "COMPANY", kycStatus: "APPROVED" },
        },
      },
      include: { seller: true },
    });
    users.push(sellerUser.id);
    const seller = sellerUser.seller!;
    categoryId = (
      await db.category.create({
        data: { slug: key, nameAr: "اختبار", nameEn: "Test", commissionBps: 1000 },
      })
    ).id;

    await t.test("ready replies are capped per seller", async () => {
      await assert.rejects(tools.addReply(seller.id, { title: "x", body: "نص" }), /عنوان/);
      for (let i = 0; i < tools.MAX_REPLIES; i++)
        await tools.addReply(seller.id, { title: `رد ${i}`, body: "نص الرد" });
      await assert.rejects(
        tools.addReply(seller.id, { title: "زيادة", body: "نص" }),
        /الحد/,
      );
      const one = await db.sellerReply.findFirstOrThrow({ where: { sellerId: seller.id } });
      assert.equal(await tools.deleteReply("someone-else", one.id), false);
      assert.equal(await tools.deleteReply(seller.id, one.id), true);
    });

    await t.test("password change checks the old one and signs out others", async () => {
      await assert.rejects(
        tools.changePassword(buyer.id, { current: "wrong", next: "new-password" }),
        /الحالي غلط/,
      );
      await assert.rejects(
        tools.changePassword(buyer.id, { current: "old-password", next: "short" }),
        /8/,
      );
      const fresh = await tools.changePassword(buyer.id, {
        current: "old-password",
        next: "new-password",
      });
      assert.equal(fresh.sessionVersion, 1);
      const u = await db.user.findUniqueOrThrow({ where: { id: buyer.id } });
      assert.ok(await bcrypt.compare("new-password", u.passwordHash));
    });

    await t.test("sales search finds by number, email, product and code", async () => {
      const product = await db.product.create({
        data: {
          sellerId: seller.id,
          categoryId,
          slug: key,
          title: "اشتراك تجريبي",
          description: "وصف",
          status: "ACTIVE",
          price: 10000,
          deliveryType: "UNIQUE_CODES",
          stock: { create: { content: `CODE-${key}` } },
        },
      });
      const order = await createOrder({
        buyerId: buyer.id,
        productId: product.id,
        quantity: 1,
        selections: {},
        textInputs: {},
      });
      await markOrderPaid(order.id, { provider: "test", reference: key, amount: 10000 });
      const { number } = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      const find = (f: Parameters<typeof tools.salesWhere>[1]) =>
        db.orderItem.count({ where: tools.salesWhere(seller.id, f) });
      assert.equal(await find({}), 1);
      assert.equal(await find({ q: `#${number}` }), 1);
      assert.equal(await find({ q: `${key}-BUYER` }), 1);
      assert.equal(await find({ q: "تجريبي" }), 1);
      assert.equal(await find({ q: `CODE-${key}` }), 1);
      assert.equal(await find({ q: "nothing-matches" }), 0);
      assert.equal(await find({ from: "2000-01-01", to: "2000-01-02" }), 0);
      assert.equal(await find({ from: "bad", to: "" }), 1);
      assert.equal(
        await db.orderItem.count({ where: tools.salesWhere("other", {}) }),
        0,
      );
    });

    await t.test("csv quotes text and defuses formulas", () => {
      assert.equal(
        tools.toCsv([["=SUM(A1)", 'a"b', 5]]),
        '﻿"\'=SUM(A1)","a""b",5',
      );
    });
  } finally {
    await db.order.deleteMany({ where: { buyerId: { in: users } } });
    await db.ledgerEntry.deleteMany({ where: { seller: { userId: { in: users } } } });
    await db.product.deleteMany({ where: { categoryId } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    await db.$disconnect();
  }
});
