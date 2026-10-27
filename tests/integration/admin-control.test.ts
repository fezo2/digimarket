import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

test("admin account and seller controls against PostgreSQL", async (t) => {
  assert.ok(
    process.env.TEST_DATABASE_URL,
    "Set TEST_DATABASE_URL to an isolated, migrated test database",
  );
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  // Fixtures use small balances; production defaults to EGP 1,000.
  process.env.MIN_PAYOUT_EGP = "100";
  const { db } = await import("../../src/lib/db");
  const control = await import("../../src/lib/admin-control");
  const { createOrder, markOrderPaid } = await import("../../src/lib/orders");
  const { requestPayout } = await import("../../src/lib/wallet");
  const { listedProduct } = await import("../../src/lib/catalog");
  const key = randomUUID();
  const users: string[] = [];
  let categoryId = "";
  try {
    const admin = await db.user.create({
      data: {
        email: `${key}-admin@test.local`,
        name: "أدمن",
        passwordHash: "test-only",
        role: "ADMIN",
      },
    });
    users.push(admin.id);
    const buyer = await db.user.create({
      data: { email: `${key}-buyer@test.local`, name: "مشتري", passwordHash: "test-only" },
    });
    users.push(buyer.id);
    const sellerUser = await db.user.create({
      data: {
        email: `${key}-seller@test.local`,
        name: "تاجر",
        passwordHash: "test-only",
        role: "SELLER",
        seller: {
          create: {
            storeName: "متجر",
            slug: key,
            type: "COMPANY",
            kycStatus: "APPROVED",
            payoutMethod: "INSTAPAY",
            payoutAccount: "test@instapay",
            payoutHolderName: "تاجر",
            payoutUpdatedAt: new Date(Date.now() - 3 * 86400000),
          },
        },
      },
      include: { seller: true },
    });
    users.push(sellerUser.id);
    const seller = sellerUser.seller!;
    const category = await db.category.create({
      data: { slug: key, nameAr: "اختبار", nameEn: "Test", commissionBps: 1500 },
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
        price: 20000,
        deliveryType: "UNIQUE_CODES",
        stock: { create: [{ content: `${key}-a` }, { content: `${key}-b` }] },
      },
    });
    const order = () =>
      createOrder({
        buyerId: buyer.id,
        productId: product.id,
        quantity: 1,
        selections: {},
        textInputs: {},
      });
    const visible = () =>
      db.product.count({ where: { id: product.id, ...listedProduct } });

    await t.test("only an active admin can act", async () => {
      await assert.rejects(
        control.suspendUser(buyer.id, sellerUser.id, "سبب كافي"),
        /غير مسموح/,
      );
      await assert.rejects(
        control.suspendUser(admin.id, admin.id, "سبب كافي"),
        /حسابك/,
      );
      await assert.rejects(control.suspendUser(admin.id, buyer.id, "x"), /السبب/);
    });

    await t.test("suspending sales hides products and blocks checkout", async () => {
      assert.equal(await visible(), 1);
      assert.equal(
        await control.setSalesSuspended(admin.id, seller.id, true, "شكوى عميل"),
        true,
      );
      assert.equal(
        await control.setSalesSuspended(admin.id, seller.id, true, "شكوى عميل"),
        false,
      );
      assert.equal(await visible(), 0);
      await assert.rejects(order());
      await control.setSalesSuspended(admin.id, seller.id, false);
      assert.equal(await visible(), 1);
      const logs = await db.auditLog.count({
        where: { targetId: seller.id, action: { startsWith: "seller.sales_" } },
      });
      assert.equal(logs, 2);
    });

    await t.test("seller commission and hold override apply to new sales", async () => {
      await assert.rejects(
        control.setSellerTerms(admin.id, seller.id, { commission: "101", holdDays: "" }),
      );
      await control.setSellerTerms(admin.id, seller.id, {
        commission: "7.5",
        holdDays: "0",
      });
      const o = await order();
      await markOrderPaid(o.id, { provider: "test", reference: key, amount: 20000 });
      const item = await db.orderItem.findFirstOrThrow({
        where: { orderId: o.id },
        include: { ledger: true },
      });
      assert.equal(item.commissionBps, 750);
      assert.equal(item.commissionAmount, 1500);
      const sale = item.ledger.find((l) => l.type === "SALE")!;
      assert.ok(sale.availableAt.getTime() <= Date.now() + 1000);
      await control.setSellerTerms(admin.id, seller.id, { commission: "", holdDays: "" });
      const after = await db.sellerProfile.findUniqueOrThrow({ where: { id: seller.id } });
      assert.equal(after.commissionBps, null);
      assert.equal(after.holdDays, null);
    });

    await t.test("frozen payouts refuse new requests", async () => {
      await control.setPayoutsFrozen(admin.id, seller.id, true, "مراجعة حساب");
      await assert.rejects(requestPayout(sellerUser.id, 10000), /متجمّد/);
      await control.setPayoutsFrozen(admin.id, seller.id, false);
      const id = await requestPayout(sellerUser.id, 10000);
      assert.ok(id);
    });

    await t.test("suspending a user signs them out and is reversible", async () => {
      const before = await db.user.findUniqueOrThrow({ where: { id: buyer.id } });
      assert.equal(await control.suspendUser(admin.id, buyer.id, "احتيال"), true);
      const s = await db.user.findUniqueOrThrow({ where: { id: buyer.id } });
      assert.ok(s.suspendedAt);
      assert.equal(s.sessionVersion, before.sessionVersion + 1);
      assert.equal(await control.unsuspendUser(admin.id, buyer.id), true);
      assert.equal(await control.unsuspendUser(admin.id, buyer.id), false);
      await control.updateUserProfile(admin.id, buyer.id, {
        name: "مشتري جديد",
        phone: "01012345678",
        adminNote: "عميل مهم",
      });
      await assert.rejects(
        control.updateUserProfile(admin.id, buyer.id, { name: "اسم", phone: "123", adminNote: "" }),
        /الموبايل/,
      );
    });

    await t.test("announcements toggle once", async () => {
      const id = await control.createAnnouncement(admin.id, {
        title: "تحديث",
        body: "نص الإعلان",
      });
      assert.equal(await control.setAnnouncementActive(admin.id, id, false), true);
      assert.equal(await control.setAnnouncementActive(admin.id, id, false), false);
      await db.announcement.delete({ where: { id } });
    });
  } finally {
    await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await db.payout.deleteMany({ where: { seller: { userId: { in: users } } } });
    await db.ledgerEntry.deleteMany({ where: { seller: { userId: { in: users } } } });
    await db.order.deleteMany({ where: { buyerId: { in: users } } });
    await db.product.deleteMany({ where: { categoryId } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    await db.$disconnect();
  }
});
