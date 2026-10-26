import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

test("wallet payouts, refunds and redelivery against PostgreSQL", async (t) => {
  assert.ok(
    process.env.TEST_DATABASE_URL,
    "Set TEST_DATABASE_URL to an isolated migrated test database",
  );
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const { db } = await import("../../src/lib/db");
  const {
    saveDestination,
    requestPayout,
    processPayout,
    refundOrder,
    redeliverOrder,
    adjustLedger,
  } = await import("../../src/lib/wallet");
  const { sellerBalance } = await import("../../src/lib/ledger");
  const { createOrder, markOrderPaid, releaseExpiredOrders } =
    await import("../../src/lib/orders");
  const key = randomUUID();
  const users: string[] = [];
  const sellerIds: string[] = [];
  const productIds: string[] = [];
  const couponIds: string[] = [];
  let categoryId = "";
  let serial = 0;
  const password = "wallet-test-password";
  const passwordHash = await bcrypt.hash(password, 4);
  try {
    const admin = await db.user.create({
      data: {
        email: `${key}-admin@test.local`,
        name: "Admin",
        passwordHash,
        role: "ADMIN",
      },
    });
    users.push(admin.id);
    const buyer = await db.user.create({
      data: { email: `${key}-buyer@test.local`, name: "Buyer", passwordHash },
    });
    users.push(buyer.id);
    const category = await db.category.create({
      data: {
        slug: key,
        nameAr: "اختبار",
        nameEn: "Test",
        commissionBps: 1000,
      },
    });
    categoryId = category.id;
    async function seller(opening = 0) {
      const suffix = `${key}-${++serial}`;
      const user = await db.user.create({
        data: {
          email: suffix + "@test.local",
          name: "Seller",
          passwordHash,
          role: "SELLER",
          seller: {
            create: {
              storeName: "Wallet test",
              slug: suffix,
              kycStatus: "APPROVED",
              payoutMethod: "INSTAPAY",
              payoutAccount: "seller@instapay",
              payoutHolderName: "Seller Name",
              payoutUpdatedAt: new Date(Date.now() - 86400001),
            },
          },
        },
        include: { seller: true },
      });
      users.push(user.id);
      sellerIds.push(user.seller!.id);
      if (opening)
        await db.ledgerEntry.create({
          data: {
            sellerId: user.seller!.id,
            type: "ADJUSTMENT",
            amount: opening,
            availableAt: new Date(Date.now() - 1000),
          },
        });
      return { userId: user.id, id: user.seller!.id };
    }
    async function product(sellerId: string, codes = false) {
      const p = await db.product.create({
        data: {
          sellerId,
          categoryId,
          slug: `${key}-product-${++serial}`,
          title: "Wallet test",
          description: "Test",
          price: 20000,
          status: "ACTIVE",
          deliveryType: codes ? "UNIQUE_CODES" : "TEXT",
          deliveryContent: codes ? null : "private delivery",
          ...(codes
            ? {
                stock: {
                  create: [{ content: "code-a" }, { content: "code-b" }],
                },
              }
            : {}),
        },
      });
      productIds.push(p.id);
      return p;
    }
    async function delivered(sellerId: string, codes = false) {
      const p = await product(sellerId, codes);
      const order = await createOrder({
        buyerId: buyer.id,
        productId: p.id,
        quantity: 1,
        selections: {},
        textInputs: {},
      });
      await markOrderPaid(order.id, {
        provider: "test",
        reference: `${key}-paid-${++serial}`,
        amount: 20000,
      });
      const item = await db.orderItem.findFirstOrThrow({
        where: { orderId: order.id },
        include: { ledger: true },
      });
      return { order, item, p, sale: item.ledger[0] };
    }
    await t.test(
      "payout guards: insufficient balance, minimum, KYC, missing destination and 24-hour lock",
      async () => {
        const s = await seller(15000);
        await assert.rejects(requestPayout(s.userId, 15001), /الرصيد المتاح/);
        await assert.rejects(requestPayout(s.userId, 9999), /الحد الأدنى/);
        await db.sellerProfile.update({
          where: { id: s.id },
          data: { kycStatus: "PENDING" },
        });
        await assert.rejects(requestPayout(s.userId, 10000), /توثيق/);
        await db.sellerProfile.update({
          where: { id: s.id },
          data: { kycStatus: "APPROVED", payoutAccount: null },
        });
        await assert.rejects(requestPayout(s.userId, 10000), /بيانات/);
        await db.sellerProfile.update({
          where: { id: s.id },
          data: {
            payoutAccount: "seller@instapay",
            payoutUpdatedAt: new Date(),
          },
        });
        await assert.rejects(requestPayout(s.userId, 10000), /٢٤ ساعة/);
        assert.equal(await db.payout.count({ where: { sellerId: s.id } }), 0);
        assert.equal((await sellerBalance(s.id)).available, 15000);
      },
    );
    await t.test(
      "destination password, ownership, snapshot and audit masking",
      async () => {
        const s = await seller(30000);
        const other = await seller();
        const destination = {
          method: "MOBILE_WALLET" as const,
          account: "01012345678",
          holderName: "New Holder",
        };
        await assert.rejects(
          saveDestination(s.userId, destination, "wrong"),
          /الباسورد/,
        );
        assert.equal(await db.auditLog.count({ where: { targetId: s.id } }), 0);
        await saveDestination(s.userId, destination, password);
        const profile = await db.sellerProfile.findUniqueOrThrow({
          where: { id: s.id },
        });
        assert.equal(profile.payoutAccount, destination.account);
        assert.equal(
          (
            await db.sellerProfile.findUniqueOrThrow({
              where: { id: other.id },
            })
          ).payoutAccount,
          "seller@instapay",
        );
        const log = await db.auditLog.findFirstOrThrow({
          where: { targetId: s.id },
        });
        assert.equal(log.actorId, s.userId);
        assert.equal(log.action, "seller.payout_account_changed");
        assert.ok(!log.data!.includes(destination.account));
        assert.equal(JSON.parse(log.data!).accountLast4, "5678");
        await assert.rejects(requestPayout(s.userId, 10000), /٢٤ ساعة/);
        await db.sellerProfile.update({
          where: { id: s.id },
          data: { payoutUpdatedAt: new Date(Date.now() - 86400001) },
        });
        const id = await requestPayout(s.userId, 10000);
        await saveDestination(
          s.userId,
          { ...destination, account: "01112345678" },
          password,
        );
        const payout = await db.payout.findUniqueOrThrow({ where: { id } });
        assert.equal(payout.account, destination.account);
        assert.equal(payout.holderName, destination.holderName);
        assert.equal((await sellerBalance(s.id)).available, 20000);
      },
    );
    await t.test(
      "concurrent requests create one payout and one debit; partial unique index also rejects duplicates",
      async () => {
        const s = await seller(50000);
        const results = await Promise.allSettled([
          requestPayout(s.userId, 10000),
          requestPayout(s.userId, 10000),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(await db.payout.count({ where: { sellerId: s.id } }), 1);
        assert.equal(
          await db.ledgerEntry.count({
            where: { sellerId: s.id, type: "PAYOUT" },
          }),
          1,
        );
        assert.equal((await sellerBalance(s.id)).available, 40000);
        await assert.rejects(
          db.payout.create({
            data: {
              sellerId: s.id,
              amount: 10000,
              method: "INSTAPAY",
              account: "test@instapay",
              holderName: "Seller",
            },
          }),
          (error: unknown) => (error as { code: string }).code === "P2002",
        );
      },
    );
    await t.test(
      "rejection reverses once; double paid is idempotent; only admin can process",
      async () => {
        const s = await seller(40000);
        const id = await requestPayout(s.userId, 10000);
        await assert.rejects(
          processPayout(s.userId, id, "REJECTED", "no"),
          /غير مسموح/,
        );
        assert.deepEqual(
          (
            await Promise.all([
              processPayout(admin.id, id, "REJECTED", "wrong destination"),
              processPayout(admin.id, id, "REJECTED", "retry"),
            ])
          ).sort(),
          [false, true],
        );
        const rows = await db.ledgerEntry.findMany({
          where: { payoutId: id },
          orderBy: { amount: "asc" },
        });
        assert.deepEqual(
          rows.map((r) => r.amount),
          [-10000, 10000],
        );
        assert.equal((await sellerBalance(s.id)).available, 40000);
        const second = await requestPayout(s.userId, 10000);
        assert.equal(
          await processPayout(admin.id, second, "PAID", "TRANSFER-1"),
          true,
        );
        const before = await db.payout.findUniqueOrThrow({
          where: { id: second },
        });
        assert.equal(
          await processPayout(admin.id, second, "PAID", "OTHER"),
          false,
        );
        assert.equal(
          await processPayout(admin.id, second, "REJECTED", "late"),
          false,
        );
        assert.deepEqual(
          await db.payout.findUniqueOrThrow({ where: { id: second } }),
          before,
        );
        assert.equal(before.processedById, admin.id);
        assert.equal(before.reference, "TRANSFER-1");
        assert.equal(
          await db.ledgerEntry.count({ where: { payoutId: second } }),
          1,
        );
        assert.equal(
          await db.auditLog.count({ where: { targetId: second } }),
          1,
        );
      },
    );
    await t.test(
      "held refund lowers held only, preserves SALE and SOLD codes, and refunds once",
      async () => {
        const s = await seller(10000);
        const { order, item, p, sale } = await delivered(s.id, true);
        const coupon = await db.coupon.create({
          data: { code: `${key}-refund-coupon`, percentOff: 10, usedCount: 1 },
        });
        couponIds.push(coupon.id);
        await db.order.update({
          where: { id: order.id },
          data: { couponId: coupon.id },
        });
        assert.deepEqual(await sellerBalance(s.id), {
          available: 10000,
          held: 18000,
          total: 28000,
        });
        const result = await Promise.all([
          refundOrder(admin.id, order.id, "Externally refunded"),
          refundOrder(admin.id, order.id, "retry"),
        ]);
        assert.deepEqual(result.sort(), [false, true]);
        assert.deepEqual(await sellerBalance(s.id), {
          available: 10000,
          held: 0,
          total: 10000,
        });
        const refund = await db.ledgerEntry.findFirstOrThrow({
          where: { orderItemId: item.id, type: "REFUND" },
        });
        assert.equal(refund.amount, -18000);
        assert.equal(refund.availableAt.getTime(), sale.availableAt.getTime());
        assert.deepEqual(
          await db.ledgerEntry.findUniqueOrThrow({ where: { id: sale.id } }),
          sale,
        );
        assert.equal(
          await db.stockItem.count({
            where: { orderItemId: item.id, status: "SOLD" },
          }),
          1,
        );
        assert.equal(
          (await db.product.findUniqueOrThrow({ where: { id: p.id } }))
            .soldCount,
          0,
        );
        assert.equal(
          (await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } }))
            .usedCount,
          1,
        );
        assert.equal(
          (await db.order.findUniqueOrThrow({ where: { id: order.id } }))
            .status,
          "REFUNDED",
        );
        assert.equal(
          await db.auditLog.count({
            where: { targetId: order.id, action: "order.refunded" },
          }),
          1,
        );
      },
    );
    await t.test(
      "refund after hold and payout makes available negative and blocks next payout",
      async () => {
        const s = await seller();
        const { order, sale } = await delivered(s.id);
        // Simulate passage of the hold period in this isolated test database only.
        await db.ledgerEntry.update({
          where: { id: sale.id },
          data: { availableAt: new Date(Date.now() - 1000) },
        });
        assert.equal((await sellerBalance(s.id)).available, 18000);
        const payout = await requestPayout(s.userId, 18000);
        await processPayout(admin.id, payout, "PAID", "TRANSFER-NEGATIVE");
        await refundOrder(admin.id, order.id, "Refund after settlement");
        assert.deepEqual(await sellerBalance(s.id), {
          available: -18000,
          held: 0,
          total: -18000,
        });
        await assert.rejects(requestPayout(s.userId, 10000), /الرصيد المتاح/);
      },
    );
    await t.test(
      "paid undelivered refund releases reserved stock without any ledger entry",
      async () => {
        const s = await seller();
        const p = await product(s.id, true);
        const order = await createOrder({
          buyerId: buyer.id,
          productId: p.id,
          quantity: 2,
          selections: {},
          textInputs: {},
        });
        // Legacy paid-but-stuck fixture: payment recorded with its reservation still present.
        await db.order.update({
          where: { id: order.id },
          data: { status: "PAID", paidAmount: 1, paidAt: new Date() },
        });
        await refundOrder(admin.id, order.id, "Refunded externally");
        assert.equal(
          await db.stockItem.count({
            where: { productId: p.id, status: "AVAILABLE", orderItemId: null },
          }),
          2,
        );
        assert.equal(
          await db.ledgerEntry.count({ where: { sellerId: s.id } }),
          0,
        );
        assert.equal(
          (await db.product.findUniqueOrThrow({ where: { id: p.id } }))
            .soldCount,
          0,
        );
      },
    );
    await t.test(
      "failed redelivery changes nothing; replenished stock delivers and credits exactly once concurrently",
      async () => {
        const s = await seller();
        const p = await product(s.id, true);
        const order = await createOrder({
          buyerId: buyer.id,
          productId: p.id,
          quantity: 2,
          selections: {},
          textInputs: {},
        });
        await db.order.update({
          where: { id: order.id },
          data: { expiresAt: new Date(Date.now() - 60000) },
        });
        await releaseExpiredOrders();
        await db.stockItem.deleteMany({ where: { productId: p.id } });
        await markOrderPaid(order.id, {
          provider: "test",
          reference: `${key}-shortage`,
          amount: 40000,
        });
        const before = await db.order.findUniqueOrThrow({
          where: { id: order.id },
          include: { items: true },
        });
        assert.match(before.reviewReason!, /المخزون/);
        assert.equal(before.paidAmount, 40000);
        await db.stockItem.create({
          data: { productId: p.id, content: "new-one" },
        });
        await assert.rejects(redeliverOrder(admin.id, order.id), /المخزون/);
        assert.deepEqual(
          await db.order.findUniqueOrThrow({
            where: { id: order.id },
            include: { items: true },
          }),
          before,
        );
        assert.equal(
          await db.stockItem.count({
            where: { productId: p.id, status: "AVAILABLE", orderItemId: null },
          }),
          1,
        );
        assert.equal(
          await db.auditLog.count({ where: { targetId: order.id } }),
          0,
        );
        await db.stockItem.create({
          data: { productId: p.id, content: "new-two" },
        });
        const results = await Promise.all([
          redeliverOrder(admin.id, order.id),
          redeliverOrder(admin.id, order.id),
        ]);
        assert.deepEqual(results.sort(), [false, true]);
        assert.equal(
          await db.ledgerEntry.count({
            where: { sellerId: s.id, type: "SALE" },
          }),
          1,
        );
        assert.equal(
          await db.stockItem.count({
            where: { productId: p.id, status: "SOLD" },
          }),
          2,
        );
        assert.equal(
          (await db.product.findUniqueOrThrow({ where: { id: p.id } }))
            .soldCount,
          2,
        );
        assert.equal(
          (await db.order.findUniqueOrThrow({ where: { id: order.id } }))
            .reviewReason,
          null,
        );
        assert.equal(
          await db.auditLog.count({
            where: { targetId: order.id, action: "order.redelivered" },
          }),
          1,
        );
      },
    );
    await t.test(
      "redelivery cannot bypass amount mismatch or refunded status; adjustments require admin password",
      async () => {
        const s = await seller();
        const p = await product(s.id);
        const order = await createOrder({
          buyerId: buyer.id,
          productId: p.id,
          quantity: 1,
          selections: {},
          textInputs: {},
        });
        await markOrderPaid(order.id, {
          provider: "test",
          reference: `${key}-mismatch`,
          amount: 1,
        });
        assert.match(
          (await db.order.findUniqueOrThrow({ where: { id: order.id } }))
            .reviewReason!,
          /المبلغ المدفوع/,
        );
        await assert.rejects(
          redeliverOrder(admin.id, order.id),
          /المبلغ المدفوع/,
        );
        await assert.rejects(
          refundOrder(s.userId, order.id, "forged"),
          /غير مسموح/,
        );
        await refundOrder(admin.id, order.id, "External refund");
        const next = await createOrder({
          buyerId: buyer.id,
          productId: p.id,
          quantity: 1,
          selections: {},
          textInputs: {},
        });
        await markOrderPaid(next.id, {
          provider: "test",
          reference: `${key}-mismatch`,
          amount: 20000,
        });
        assert.equal(
          (await db.order.findUniqueOrThrow({ where: { id: next.id } })).status,
          "PENDING_PAYMENT",
        );

        await assert.rejects(redeliverOrder(admin.id, order.id), /مش مدفوع/);
        await assert.rejects(
          adjustLedger(admin.id, s.id, 10000, "Correction", "wrong"),
          /الباسورد/,
        );
        await assert.rejects(
          adjustLedger(s.userId, s.id, 10000, "Correction", password),
          /غير مسموح/,
        );
        await adjustLedger(admin.id, s.id, 12000, "Correction", password);
        await adjustLedger(
          admin.id,
          s.id,
          -1000,
          "Correction reversal",
          password,
        );
        assert.deepEqual(await sellerBalance(s.id), {
          available: 11000,
          held: 0,
          total: 11000,
        });
        assert.equal(
          await db.auditLog.count({
            where: { targetId: s.id, action: "ledger.adjustment" },
          }),
          2,
        );
      },
    );
  } finally {
    // Fixture cleanup is restricted to rows created by this test run.
    await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await db.ledgerEntry.deleteMany({ where: { sellerId: { in: sellerIds } } });
    await db.payout.deleteMany({ where: { sellerId: { in: sellerIds } } });
    await db.stockItem.deleteMany({ where: { productId: { in: productIds } } });
    await db.order.deleteMany({ where: { buyerId: { in: users } } });
    await db.product.deleteMany({ where: { id: { in: productIds } } });
    await db.coupon.deleteMany({ where: { id: { in: couponIds } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    await db.$disconnect();
  }
});
