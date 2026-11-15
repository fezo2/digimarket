import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

// Explicit opt-in: this suite creates and removes only its own fixture rows.
test("affiliate attribution, earning, refund reversal and payouts", async (t) => {
  assert.ok(process.env.TEST_DATABASE_URL, "Set TEST_DATABASE_URL to an isolated, migrated test database");
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const { db } = await import("../../src/lib/db");
  const { createOrder, markOrderPaid } = await import("../../src/lib/orders");
  const { refundOrder } = await import("../../src/lib/wallet");
  const affiliateLib = await import("../../src/lib/affiliate");
  const key = randomUUID();
  const code = "t" + key.slice(0, 8);
  const users: string[] = [];
  let categoryId = "";
  const user = async (name: string, extra: object = {}) => {
    const u = await db.user.create({
      data: { email: `${key}-${name}@test.local`, name, passwordHash: "test-only", emailVerifiedAt: new Date(), ...extra },
    });
    users.push(u.id);
    return u;
  };
  try {
    const admin = await user("admin", { role: "ADMIN" });
    const buyer = await user("buyer");
    const promoter = await user("promoter");
    const sellerUser = await db.user.create({
      data: {
        email: `${key}-seller@test.local`,
        name: "تاجر",
        passwordHash: "test-only",
        role: "SELLER",
        seller: { create: { storeName: "متجر", slug: key, type: "COMPANY", kycStatus: "APPROVED" } },
      },
      include: { seller: true },
    });
    users.push(sellerUser.id);
    const seller = sellerUser.seller!;
    const category = await db.category.create({
      data: { slug: key, nameAr: "اختبار", nameEn: "Test", commissionBps: 1000 },
    });
    categoryId = category.id;
    const product = await db.product.create({
      data: {
        sellerId: seller.id,
        categoryId,
        slug: key,
        title: "منتج",
        description: "وصف",
        status: "ACTIVE",
        price: 10000,
        deliveryType: "TEXT",
        deliveryContent: "secret",
        maxQty: 10,
      },
    });
    await affiliateLib.joinAffiliate(promoter.id, code.toUpperCase());
    const affiliate = await db.affiliate.findUniqueOrThrow({ where: { userId: promoter.id } });
    assert.equal(affiliate.code, code);
    await assert.rejects(affiliateLib.joinAffiliate(buyer.id, code), /مستخدم/);

    const buy = async (buyerId: string, ref?: string) => {
      const { id } = await createOrder({
        buyerId,
        productId: product.id,
        quantity: 1,
        selections: {},
        textInputs: {},
        affiliateCode: ref,
      });
      await markOrderPaid(id, { provider: "test", reference: "aff-" + randomUUID(), amount: 10000 });
      return db.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
    };

    await t.test("a referred sale earns 5% of the total, held like the sale", async () => {
      const order = await buy(buyer.id, code);
      assert.equal(order.affiliateId, affiliate.id);
      assert.equal(order.items[0].affiliateBps, 500);
      const entry = await db.affiliateEntry.findFirstOrThrow({ where: { orderItemId: order.items[0].id } });
      assert.equal(entry.type, "COMMISSION");
      assert.equal(entry.amount, 500);
      const sale = await db.ledgerEntry.findFirstOrThrow({ where: { orderItemId: order.items[0].id, type: "SALE" } });
      assert.equal(sale.amount, 9000, "the seller's net is untouched");
      assert.ok(entry.availableAt >= sale.availableAt);
      const balance = await affiliateLib.affiliateBalance(affiliate.id);
      assert.equal(balance.held, 500);
      assert.equal(balance.available, 0);
    });

    await t.test("self-referral and the seller's own link earn nothing", async () => {
      const own = await createOrder({
        buyerId: promoter.id,
        productId: product.id,
        quantity: 1,
        selections: {},
        textInputs: {},
        affiliateCode: code,
      });
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: own.id } })).affiliateId, null);
      await db.order.delete({ where: { id: own.id } });
      await db.affiliate.create({ data: { userId: sellerUser.id, code: code + "s" } });
      const order = await buy(buyer.id, code + "s");
      assert.equal(order.affiliateId, null);
      assert.equal(await db.affiliateEntry.count({ where: { orderItemId: order.items[0].id } }), 0);
    });

    await t.test("a store set to 0% turns the program off for its products", async () => {
      await db.sellerProfile.update({ where: { id: seller.id }, data: { affiliateBps: 0 } });
      const order = await buy(buyer.id, code);
      assert.equal(order.affiliateId, null);
      await db.sellerProfile.update({ where: { id: seller.id }, data: { affiliateBps: null } });
    });

    await t.test("the share is capped at the platform commission", async () => {
      await db.affiliate.update({ where: { id: affiliate.id }, data: { rateBps: 5000 } });
      const order = await buy(buyer.id, code);
      const entry = await db.affiliateEntry.findFirstOrThrow({ where: { orderItemId: order.items[0].id } });
      assert.equal(entry.amount, 1000);
      await db.affiliate.update({ where: { id: affiliate.id }, data: { rateBps: null } });
    });

    await t.test("a refund reverses the commission once", async () => {
      const order = await buy(buyer.id, code);
      await refundOrder(admin.id, order.id, "refund test");
      const entries = await db.affiliateEntry.findMany({ where: { orderItemId: order.items[0].id } });
      assert.deepEqual(entries.map((e) => e.amount).sort((a, b) => a - b), [-500, 500]);
    });

    await t.test("payouts need a released balance; rejection gives the money back", async () => {
      await db.affiliateEntry.updateMany({ where: { affiliateId: affiliate.id }, data: { availableAt: new Date(0) } });
      await db.affiliate.update({
        where: { id: affiliate.id },
        data: {
          payoutMethod: "MOBILE_WALLET",
          payoutAccount: "01000000000",
          payoutHolderName: "مسوق",
          payoutUpdatedAt: new Date(0),
        },
      });
      const before = await affiliateLib.affiliateBalance(affiliate.id);
      assert.equal(before.available, 1500);
      await assert.rejects(affiliateLib.requestAffiliatePayout(promoter.id, 1500), /الحد الأدنى/);
      await db.affiliateSettings.upsert({
        where: { id: "default" },
        create: { id: "default", minPayout: 100 },
        update: { minPayout: 100 },
      });
      await assert.rejects(affiliateLib.requestAffiliatePayout(promoter.id, 1501), /الرصيد المتاح/);
      const id = await affiliateLib.requestAffiliatePayout(promoter.id, 1500);
      assert.equal((await affiliateLib.affiliateBalance(affiliate.id)).available, 0);
      assert.equal(await affiliateLib.processAffiliatePayout(admin.id, id, "REJECTED", "اختبار"), true);
      assert.equal(await affiliateLib.processAffiliatePayout(admin.id, id, "PAID", "x"), false);
      assert.equal((await affiliateLib.affiliateBalance(affiliate.id)).available, 1500);
    });

    await t.test("suspension with reversal takes back held commissions and blocks new ones", async () => {
      const order = await buy(buyer.id, code);
      assert.equal(await affiliateLib.suspendAffiliate(admin.id, affiliate.id, "غش واضح", true), true);
      const entries = await db.affiliateEntry.findMany({ where: { orderItemId: order.items[0].id } });
      assert.equal(entries.reduce((s, e) => s + e.amount, 0), 0);
      const later = await buy(buyer.id, code);
      assert.equal(later.affiliateId, null);
      await assert.rejects(affiliateLib.requestAffiliatePayout(promoter.id, 1000), /موقوف/);
    });
  } finally {
    await db.affiliateSettings.deleteMany({ where: { id: "default" } });
    if (users.length) {
      await db.affiliateEntry.deleteMany({ where: { affiliate: { userId: { in: users } } } });
      await db.ledgerEntry.deleteMany({ where: { seller: { userId: { in: users } } } });
      await db.order.deleteMany({ where: { buyerId: { in: users } } });
      await db.affiliate.deleteMany({ where: { userId: { in: users } } });
      await db.product.deleteMany({ where: { slug: key } });
      await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
    }
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    await db.$disconnect();
  }
});
