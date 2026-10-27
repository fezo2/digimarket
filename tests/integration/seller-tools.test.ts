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
        buyerIp: "41.33.12.7",
        buyerCountry: "EG",
      });
      await markOrderPaid(order.id, { provider: "test", reference: key, amount: 10000 });
      const { number, buyerIp, buyerCountry } = await db.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      assert.equal(buyerIp, "41.33.12.7");
      assert.equal(buyerCountry, "EG");
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
      assert.equal(await find({ p: "today" }), 1);
      assert.equal(await find({ p: "yesterday" }), 0);
      assert.equal(await find({ status: "paid", review: "none" }), 1);
      assert.equal(await find({ status: "refunded" }), 0);
      assert.equal(await find({ review: "positive" }), 0);
      assert.equal(await find({ delivery: "refunded" }), 0);
      assert.equal(
        await db.orderItem.count({ where: tools.salesWhere("other", {}) }),
        0,
      );
    });

    await t.test("seller refunds their own sale, admin then pays the buyer", async () => {
      const wallet = await import("../../src/lib/wallet");
      const { sellerBalance } = await import("../../src/lib/ledger");
      const item = await db.orderItem.findFirstOrThrow({
        where: { sellerId: seller.id },
        include: { order: true },
      });
      const orderId = item.orderId;
      await assert.rejects(wallet.sellerRefundOrder(buyer.id, orderId, "x"), /غير مسموح/);
      await assert.rejects(wallet.sellerRefundOrder(sellerUser.id, orderId, " "), /السبب/);
      const before = await sellerBalance(seller.id);
      const done = await wallet.sellerRefundOrder(sellerUser.id, orderId, "الكود مش شغال");
      assert.equal(done && done.number, item.order.number);
      assert.equal(await wallet.sellerRefundOrder(sellerUser.id, orderId, "تاني"), null);
      const after = await sellerBalance(seller.id);
      assert.equal(before.total - after.total, item.sellerNet);
      const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
      assert.equal(order.status, "REFUNDED");
      assert.equal(order.refundPaidAt, null);
      assert.equal(
        (await db.orderItem.findUniqueOrThrow({ where: { id: item.id } })).refundedAmount,
        item.total,
      );
      assert.ok(
        await db.message.findFirst({ where: { orderId, kind: "SYSTEM", body: { contains: "الكود مش شغال" } } }),
      );
      await assert.rejects(wallet.markRefundPaid(sellerUser.id, orderId), /غير مسموح/);
      const admin = await db.user.create({
        data: { email: `${key}-admin@test.local`, name: "ادمن", passwordHash: "x", role: "ADMIN" },
      });
      users.push(admin.id);
      assert.equal(await wallet.markRefundPaid(admin.id, orderId), true);
      assert.equal(await wallet.markRefundPaid(admin.id, orderId), false);
    });

    await t.test("admin alert is best-effort and needs a chat id", async () => {
      const { alertAdmin } = await import("../../src/lib/notifications");
      const saved = { ...process.env };
      const sent: string[] = [];
      const fake = (async (_url: string, init: RequestInit) => {
        sent.push(String(init.body));
        return new Response(JSON.stringify({ ok: true }));
      }) as typeof fetch;
      try {
        delete process.env.ADMIN_TELEGRAM_CHAT_ID;
        process.env.TELEGRAM_BOT_TOKEN = "test-token";
        assert.equal(await alertAdmin("x", fake), false);
        process.env.ADMIN_TELEGRAM_CHAT_ID = "123";
        assert.equal(await alertAdmin("تحويل جديد", fake), true);
        assert.match(sent[0], /"chat_id":"123"/);
        const broken = (async () => {
          throw new Error("network");
        }) as typeof fetch;
        assert.equal(await alertAdmin("x", broken), false);
      } finally {
        process.env = saved;
      }
    });

    await t.test("seller promo codes work at checkout in any letter case", async () => {
      const promo = await import("../../src/lib/promo-codes");
      const { applyCoupon } = await import("../../src/lib/orders");
      const code = `save-${key.slice(0, 8)}`;
      const form = { code, kind: "percent" as const, value: "20", minTotal: "", usageLimit: "", expires: "" };
      await assert.rejects(promo.createPromo(seller.id, { ...form, value: "95" }), /٩٠/);
      await assert.rejects(promo.createPromo(seller.id, { ...form, code: "a b" }), /حرف/);
      await assert.rejects(promo.createPromo(seller.id, { ...form, expires: "2000-01-01" }), /المستقبل/);
      const created = await promo.createPromo(seller.id, form);
      assert.equal(created.code, code.toUpperCase());
      assert.equal(created.percentOff, 20);
      await assert.rejects(promo.createPromo(seller.id, form), /مستخدم/);
      assert.equal(await promo.setPromoActive("someone-else", created.id, false), false);
      const product = await db.product.create({
        data: {
          sellerId: seller.id,
          categoryId,
          slug: `${key}-promo`,
          title: "منتج بالكود",
          description: "وصف",
          status: "ACTIVE",
          price: 10000,
          deliveryType: "TEXT",
          deliveryContent: "سر",
        },
      });
      const order = await createOrder({
        buyerId: buyer.id,
        productId: product.id,
        quantity: 1,
        selections: {},
        textInputs: {},
      });
      await applyCoupon(order.id, buyer.id, code.toLowerCase());
      const priced = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(priced.couponId, created.id);
      assert.equal(priced.total, 8000);
      await assert.rejects(promo.deletePromo(seller.id, created.id), /تقدر توقفه/);
      assert.equal(await promo.setPromoActive(seller.id, created.id, false), true);
      await assert.rejects(applyCoupon(order.id, buyer.id, code), /الكوبون/);
    });

    await t.test("csv quotes text and defuses formulas", () => {
      assert.equal(
        tools.toCsv([["=SUM(A1)", 'a"b', 5]]),
        '﻿"\'=SUM(A1)","a""b",5',
      );
    });
  } finally {
    await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await db.order.deleteMany({ where: { buyerId: { in: users } } });
    await db.ledgerEntry.deleteMany({ where: { seller: { userId: { in: users } } } });
    await db.product.deleteMany({ where: { categoryId } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    await db.$disconnect();
  }
});
