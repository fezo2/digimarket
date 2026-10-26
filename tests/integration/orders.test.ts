import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

// Explicit opt-in: this suite creates and removes only its own fixture rows.
test("checkout transactions and payment security against PostgreSQL", async (t) => {
  assert.ok(
    process.env.TEST_DATABASE_URL,
    "Set TEST_DATABASE_URL to an isolated, migrated test database",
  );
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const { db } = await import("../../src/lib/db");
  const {
    createOrder,
    applyCoupon,
    markOrderPaid,
    releaseExpiredOrders,
    preparePayment,
  } = await import("../../src/lib/orders");
  const key = randomUUID();
  const users: string[] = [];
  const products: string[] = [];
  const coupons: string[] = [];
  let categoryId = "";
  try {
    const buyer = await db.user.create({
      data: {
        email: `${key}-buyer@test.local`,
        name: "مشتري",
        passwordHash: "test-only",
      },
    });
    users.push(buyer.id);
    const buyer2 = await db.user.create({
      data: {
        email: `${key}-buyer2@test.local`,
        name: "مشتري ثاني",
        passwordHash: "test-only",
      },
    });
    users.push(buyer2.id);
    const sellerUser = await db.user.create({
      data: {
        email: `${key}-seller@test.local`,
        name: "تاجر",
        passwordHash: "test-only",
        role: "SELLER",
        seller: {
          create: {
            storeName: "شركة اختبار",
            slug: key,
            type: "COMPANY",
            kycStatus: "APPROVED",
          },
        },
      },
      include: { seller: true },
    });
    users.push(sellerUser.id);
    const individualUser = await db.user.create({
      data: {
        email: `${key}-individual@test.local`,
        name: "فرد",
        passwordHash: "test-only",
        role: "SELLER",
        seller: {
          create: {
            storeName: "فرد اختبار",
            slug: key + "-individual",
            type: "INDIVIDUAL",
            kycStatus: "APPROVED",
          },
        },
      },
      include: { seller: true },
    });
    users.push(individualUser.id);
    const seller = sellerUser.seller!;
    const individual = individualUser.seller!;
    const category = await db.category.create({
      data: {
        slug: key,
        nameAr: "اختبار",
        nameEn: "Test",
        commissionBps: 1500,
      },
    });
    categoryId = category.id;
    const product = await db.product.create({
      data: {
        sellerId: seller.id,
        categoryId,
        slug: key,
        title: "منتج اختبار",
        description: "وصف",
        status: "ACTIVE",
        price: 10000,
        deliveryType: "UNIQUE_CODES",
        instructions: "تعليمات أصلية",
        maxQty: 10,
        options: {
          create: {
            name: "المدة",
            kind: "select",
            required: true,
            values: { create: { label: "شهر", priceDelta: 2000 } },
          },
        },
        quantityDiscounts: { create: { minQty: 2, percentOff: 5 } },
        stock: {
          create: Array.from({ length: 10 }, (_, i) => ({
            content: `secret-${key}-${i}`,
          })),
        },
      },
      include: { options: { include: { values: true } } },
    });
    products.push(product.id);
    const input = {
      buyerId: buyer.id,
      productId: product.id,
      quantity: 2,
      selections: { [product.options[0].id]: product.options[0].values[0].id },
      textInputs: {},
    };
    const getOrder = (id: string) =>
      db.order.findUniqueOrThrow({
        where: { id },
        include: { items: { include: { stockItems: true, ledger: true } } },
      });
    await t.test(
      "buyer limits serialize concurrent attempts and ignore expired orders",
      async () => {
        const limitedBuyer = await db.user.create({
          data: {
            email: `${key}-limited@test.local`,
            name: "Limit test",
            passwordHash: "test-only",
          },
        });
        users.push(limitedBuyer.id);
        const fixtures = [];
        for (let i = 0; i < 4; i++) {
          const p = await db.product.create({
            data: {
              sellerId: seller.id,
              categoryId,
              slug: `${key}-limit-${i}`,
              title: "Limit test",
              description: "Test",
              status: "ACTIVE",
              price: 10000,
              deliveryType: "UNIQUE_CODES",
              stock: {
                create: [
                  { content: `${key}-${i}-a` },
                  { content: `${key}-${i}-b` },
                ],
              },
            },
          });
          products.push(p.id);
          fixtures.push({
            ...input,
            buyerId: limitedBuyer.id,
            productId: p.id,
            quantity: 1,
            selections: {},
          });
        }
        const same = await Promise.allSettled([
          createOrder(fixtures[0]),
          createOrder(fixtures[0]),
        ]);
        assert.equal(same.filter((r) => r.status === "fulfilled").length, 1);
        assert.match(
          (same.find((r) => r.status === "rejected") as PromiseRejectedResult)
            .reason.message,
          /عندك طلب مستني الدفع للمنتج ده/,
        );
        await createOrder(fixtures[1]);
        const overall = await Promise.allSettled([
          createOrder(fixtures[2]),
          createOrder(fixtures[3]),
        ]);
        assert.equal(overall.filter((r) => r.status === "fulfilled").length, 1);
        assert.match(
          (
            overall.find(
              (r) => r.status === "rejected",
            ) as PromiseRejectedResult
          ).reason.message,
          /٣ طلبات/,
        );
        assert.equal(
          await db.order.count({
            where: { buyerId: limitedBuyer.id, status: "PENDING_PAYMENT" },
          }),
          3,
        );
        assert.equal(
          await db.stockItem.count({
            where: {
              productId: { in: fixtures.map((p) => p.productId) },
              status: "RESERVED",
            },
          }),
          3,
        );
        const first = (
          same.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<{
            id: string;
          }>
        ).value;
        await db.order.update({
          where: { id: first.id },
          data: { expiresAt: new Date(Date.now() - 60000) },
        });
        await createOrder(fixtures[0]);
        assert.equal((await getOrder(first.id)).status, "CANCELLED");
        assert.equal(
          await db.order.count({
            where: { buyerId: limitedBuyer.id, status: "PENDING_PAYMENT" },
          }),
          3,
        );
      },
    );
    await t.test(
      "coupon minimum uses discounted snapshot; exhausted coupon releases reserved stock",
      async () => {
        const order = await createOrder({ ...input, buyerId: buyer2.id });
        const reservedIds = (await getOrder(order.id)).items[0].stockItems.map(
          (s) => s.id,
        );
        const coupon = await db.coupon.create({
          data: {
            code: `${key}-minimum`,
            percentOff: 10,
            minTotal: 23000,
            usageLimit: 1,
          },
        });
        coupons.push(coupon.id);
        const { formatEGP } = await import("../../src/lib/money");
        await assert.rejects(
          applyCoupon(order.id, buyer2.id, coupon.code),
          (err: unknown) => {
            assert.ok(err instanceof Error);
            assert.ok(err.message.includes(formatEGP(23000)));
            assert.match(err.message, /الحد الأدنى/);
            return true;
          },
        );
        const unchanged = await getOrder(order.id);
        assert.equal(unchanged.total, 22800);
        assert.equal(unchanged.couponId, null);
        await db.coupon.update({
          where: { id: coupon.id },
          data: { minTotal: 22800 },
        });
        await applyCoupon(order.id, buyer2.id, coupon.code);
        assert.equal((await getOrder(order.id)).total, 20520);
        await db.coupon.update({
          where: { id: coupon.id },
          data: { usedCount: 1 },
        });
        await markOrderPaid(order.id, {
          provider: "test",
          reference: `${key}-exhausted`,
          amount: 20520,
        });
        const paid = await getOrder(order.id);
        assert.equal(paid.status, "PAID");
        assert.equal(paid.items[0].deliveredAt, null);
        assert.equal(paid.items[0].ledger.length, 0);
        assert.equal(paid.items[0].stockItems.length, 0);
        const released = await db.stockItem.findMany({
          where: { id: { in: reservedIds } },
        });
        assert.equal(released.length, 2);
        assert.ok(
          released.every(
            (s) => s.status === "AVAILABLE" && s.orderItemId === null,
          ),
        );
        assert.equal(
          (await db.coupon.findUniqueOrThrow({ where: { id: coupon.id } }))
            .usedCount,
          1,
        );
      },
    );
    let paidId = "";
    await t.test(
      "snapshot price, concurrent payment idempotency, stock and 3-day held earnings",
      async () => {
        const order = await createOrder(input);
        paidId = order.id;
        const pending = await getOrder(order.id);
        assert.equal(pending.total, 22800);
        assert.equal(pending.items[0].commissionAmount, 3420);
        assert.equal(pending.items[0].stockItems.length, 2);
        assert.ok(
          pending.items[0].stockItems.every((s) => s.status === "RESERVED"),
        );
        await Promise.all([
          markOrderPaid(order.id, {
            provider: "test",
            reference: key + "-paid",
            amount: 22800,
          }),
          markOrderPaid(order.id, {
            provider: "test",
            reference: key + "-paid",
            amount: 22800,
          }),
        ]);
        const paid = await getOrder(order.id);
        const item = paid.items[0];
        assert.equal(paid.status, "PAID");
        assert.ok(item.deliveredAt);
        assert.equal(item.ledger.length, 1);
        assert.equal(item.ledger[0].amount, 19380);
        assert.equal(new Set(item.stockItems.map((s) => s.content)).size, 2);
        assert.ok(item.stockItems.every((s) => s.status === "SOLD"));
        assert.equal(
          item.ledger[0].availableAt.getTime() - paid.paidAt!.getTime(),
          3 * 86400000,
        );
        assert.equal(
          (await db.product.findUniqueOrThrow({ where: { id: product.id } }))
            .soldCount,
          2,
        );
      },
    );
    await t.test(
      "same payment retry is silent; a different payment logs refund alert without side effects",
      async (t) => {
        const before = await getOrder(paidId);
        const soldBefore = (
          await db.product.findUniqueOrThrow({ where: { id: product.id } })
        ).soldCount;
        const errors = t.mock.method(console, "error", () => {});
        try {
          await markOrderPaid(paidId, {
            provider: "test",
            reference: `${key}-paid`,
            amount: 22800,
          });
          assert.equal(errors.mock.callCount(), 0);
          await markOrderPaid(paidId, {
            provider: "test",
            reference: `${key}-second-payment`,
            amount: 22800,
          });
          assert.equal(errors.mock.callCount(), 1);
          assert.deepEqual(errors.mock.calls[0].arguments, [
            "Duplicate payment on paid order; refund required",
            { orderId: paidId },
          ]);
          assert.deepEqual(await getOrder(paidId), before);
          assert.equal(
            (await db.product.findUniqueOrThrow({ where: { id: product.id } }))
              .soldCount,
            soldBefore,
          );
        } finally {
          errors.mock.restore();
        }
      },
    );
    await t.test(
      "last-code race, expiry releases stock, late payment cannot steal another reservation",
      async () => {
        const last = await db.product.create({
          data: {
            sellerId: seller.id,
            categoryId,
            slug: key + "-last",
            title: "آخر كود",
            description: "وصف",
            status: "ACTIVE",
            price: 10000,
            deliveryType: "UNIQUE_CODES",
            stock: { create: { content: key + "-last-code" } },
          },
        });
        products.push(last.id);
        const v = { ...input, productId: last.id, quantity: 1, selections: {} };
        const results = await Promise.allSettled([
          createOrder(v),
          createOrder({ ...v, buyerId: buyer2.id }),
        ]);
        const fulfilled = results.filter((r) => r.status === "fulfilled");
        assert.equal(fulfilled.length, 1);
        const rejected = results.find(
          (r) => r.status === "rejected",
        ) as PromiseRejectedResult;
        assert.match(rejected.reason.message, /الكمية المتاحة مش كفاية/);
        const id = (fulfilled[0] as PromiseFulfilledResult<{ id: string }>)
          .value.id;
        await db.order.update({
          where: { id },
          data: { expiresAt: new Date(Date.now() - 60000) },
        });
        await releaseExpiredOrders();
        assert.equal((await getOrder(id)).status, "CANCELLED");
        assert.equal(
          await db.stockItem.count({
            where: {
              productId: last.id,
              status: "AVAILABLE",
              orderItemId: null,
            },
          }),
          1,
        );
        const replacement = await createOrder(v);
        await markOrderPaid(id, {
          provider: "test",
          reference: key + "-late-shortage",
          amount: 10000,
        });
        const late = await getOrder(id);
        assert.equal(late.status, "PAID");
        assert.equal(late.items[0].deliveredAt, null);
        assert.equal(late.items[0].ledger.length, 0);
        assert.equal(
          (await getOrder(replacement.id)).items[0].stockItems[0].status,
          "RESERVED",
        );
      },
    );
    await t.test(
      "late confirmed payment re-reserves available stock after cancellation",
      async () => {
        const order = await createOrder(input);
        await db.order.update({
          where: { id: order.id },
          data: { expiresAt: new Date(Date.now() - 60000) },
        });
        await releaseExpiredOrders();
        await markOrderPaid(order.id, {
          provider: "test",
          reference: key + "-late-ok",
          amount: 22800,
        });
        const paid = await getOrder(order.id);
        assert.equal(paid.status, "PAID");
        assert.ok(paid.items[0].deliveredAt);
        assert.equal(paid.items[0].stockItems.length, 2);
      },
    );
    await t.test(
      "wrong amount records paid without delivery or ledger; reference replay rejected",
      async () => {
        const order = await createOrder(input);
        const reservedIds = (await getOrder(order.id)).items[0].stockItems.map(
          (s) => s.id,
        );
        await markOrderPaid(order.id, {
          provider: "test",
          reference: key + "-mismatch",
          amount: 1,
        });
        const paid = await getOrder(order.id);
        assert.equal(paid.status, "PAID");
        assert.equal(paid.items[0].deliveredAt, null);
        assert.equal(paid.items[0].ledger.length, 0);
        assert.equal(paid.items[0].stockItems.length, 0);
        const released = await db.stockItem.findMany({
          where: { id: { in: reservedIds } },
        });
        assert.equal(released.length, 2);
        assert.ok(
          released.every(
            (s) => s.status === "AVAILABLE" && s.orderItemId === null,
          ),
        );
        const replay = await createOrder(input);
        await markOrderPaid(replay.id, {
          provider: "test",
          reference: key + "-paid",
          amount: 22800,
        });
        assert.equal((await getOrder(replay.id)).status, "PENDING_PAYMENT");
      },
    );
    await t.test(
      "required/forged options, own-product purchase and unapproved seller rejected",
      async () => {
        await assert.rejects(createOrder({ ...input, selections: {} }));
        await assert.rejects(
          createOrder({
            ...input,
            selections: { [product.options[0].id]: "another-option-value" },
          }),
        );
        await assert.rejects(createOrder({ ...input, buyerId: sellerUser.id }));
        await assert.rejects(createOrder({ ...input, quantity: 11 }));
        await db.sellerProfile.update({
          where: { id: seller.id },
          data: { kycStatus: "PENDING" },
        });
        await assert.rejects(createOrder(input));
        await db.sellerProfile.update({
          where: { id: seller.id },
          data: { kycStatus: "APPROVED" },
        });
      },
    );
    await t.test(
      "coupon scope/expiry/removal, frozen pricing snapshots, individual 7-day hold",
      async () => {
        const text = await db.product.create({
          data: {
            sellerId: individual.id,
            categoryId,
            slug: key + "-text",
            title: "نص",
            description: "وصف",
            status: "ACTIVE",
            price: 10000,
            deliveryType: "TEXT",
            deliveryContent: "original secret",
            instructions: "original instructions",
          },
        });
        products.push(text.id);
        const order = await createOrder({
          ...input,
          productId: text.id,
          quantity: 1,
          selections: {},
        });
        const foreign = await db.coupon.create({
          data: { code: key + "-foreign", sellerId: seller.id, percentOff: 10 },
        });
        coupons.push(foreign.id);
        const expired = await db.coupon.create({
          data: {
            code: key + "-expired",
            percentOff: 10,
            expiresAt: new Date(Date.now() - 1),
          },
        });
        coupons.push(expired.id);
        await assert.rejects(applyCoupon(order.id, buyer.id, foreign.code));
        await assert.rejects(applyCoupon(order.id, buyer.id, expired.code));
        await assert.rejects(applyCoupon(order.id, buyer2.id, ""));
        const global = await db.coupon.create({
          data: { code: key + "-global", percentOff: 10, usageLimit: 1 },
        });
        coupons.push(global.id);
        await db.product.update({
          where: { id: text.id },
          data: {
            price: 50000,
            deliveryContent: "edited secret",
            instructions: "edited instructions",
          },
        });
        await db.category.update({
          where: { id: categoryId },
          data: { commissionBps: 5000 },
        });
        await applyCoupon(order.id, buyer.id, global.code);
        assert.equal((await getOrder(order.id)).total, 9000);
        await applyCoupon(order.id, buyer.id, "");
        assert.equal((await getOrder(order.id)).total, 10000);
        await applyCoupon(order.id, buyer.id, global.code);
        await preparePayment(order.id, buyer.id, "test");
        await assert.rejects(applyCoupon(order.id, buyer.id, ""));
        await markOrderPaid(order.id, {
          provider: "test",
          reference: key + "-individual",
          amount: 9000,
        });
        const paid = await getOrder(order.id);
        const item = paid.items[0];
        assert.equal(item.deliveryContent, "original secret");
        assert.equal(item.instructions, "original instructions");
        assert.equal(item.commissionBps, 1500);
        assert.equal(item.commissionAmount, 1350);
        assert.equal(
          item.ledger[0].availableAt.getTime() - paid.paidAt!.getTime(),
          7 * 86400000,
        );
        assert.equal(
          (await db.coupon.findUniqueOrThrow({ where: { id: global.id } }))
            .usedCount,
          1,
        );
      },
    );
    await t.test(
      "Paymob intention request, signed callback binding, and repeated callbacks",
      async () => {
        process.env.PAYMENT_PROVIDER = "paymob";
        process.env.PAYMOB_SECRET_KEY = "fixture-secret";
        process.env.PAYMOB_PUBLIC_KEY = "fixture-public";
        process.env.PAYMOB_HMAC_SECRET = "fixture-hmac";
        process.env.PAYMOB_INTEGRATION_IDS = "321,322";
        process.env.APP_URL = "https://example.test";
        const { getPaymentProvider } = await import("../../src/lib/payments");
        const { paymobHmac } = await import("../../src/lib/payments/hmac");
        const { POST } =
          await import("../../src/app/api/payments/paymob/webhook/route");
        const p = await db.product.create({
          data: {
            sellerId: seller.id,
            categoryId,
            slug: key + "-paymob",
            title: "دفع",
            description: "وصف",
            status: "ACTIVE",
            price: 10000,
            deliveryType: "TEXT",
            deliveryContent: "webhook secret",
          },
        });
        products.push(p.id);
        const order = await createOrder({
          ...input,
          productId: p.id,
          quantity: 1,
          selections: {},
        });
        const prepared = await preparePayment(order.id, buyer.id, "paymob");
        const originalFetch = globalThis.fetch;
        let requests = 0;
        globalThis.fetch = async (url, init) => {
          requests++;
          assert.equal(String(url), "https://accept.paymob.com/v1/intention/");
          const body = JSON.parse(String(init?.body));
          assert.equal(body.amount, 10000);
          assert.equal(body.special_reference, order.id);
          assert.deepEqual(body.payment_methods, [321, 322]);
          assert.equal(body.billing_data.phone_number, "NA");
          return Response.json({
            client_secret: "fixture-client",
            intention_order_id: 123456,
          });
        };
        try {
          const provider = getPaymentProvider();
          assert.match(
            await provider.createPayment(prepared),
            /publicKey=fixture-public&clientSecret=fixture-client/,
          );
          await provider.createPayment(prepared);
          assert.equal(requests, 1);
        } finally {
          globalThis.fetch = originalFetch;
        }
        const obj = {
          amount_cents: 10000,
          created_at: "2026-10-26T12:00:00",
          currency: "EGP",
          error_occured: false,
          has_parent_transaction: false,
          id: 987654321,
          integration_id: 321,
          is_3d_secure: true,
          is_auth: false,
          is_capture: false,
          is_refunded: false,
          is_standalone_payment: true,
          is_voided: false,
          order: { id: 123456, merchant_order_id: order.id },
          owner: 789,
          pending: false,
          source_data: { pan: "2345", sub_type: "MasterCard", type: "card" },
          success: true,
        };
        const hmac = paymobHmac(obj, "fixture-hmac");
        const request = (value: unknown, signature: string) =>
          new Request(
            `https://example.test/api/payments/paymob/webhook?hmac=${signature}`,
            { method: "POST", body: JSON.stringify({ obj: value }) },
          );
        assert.equal((await POST(request(obj, "invalid"))).status, 401);
        const another = await createOrder({
          ...input,
          buyerId: buyer2.id,
          productId: p.id,
          quantity: 1,
          selections: {},
        });
        await preparePayment(another.id, buyer2.id, "paymob");
        assert.equal(
          (
            await POST(
              request(
                {
                  ...obj,
                  order: { ...obj.order, merchant_order_id: another.id },
                },
                hmac,
              ),
            )
          ).status,
          200,
        );
        assert.equal((await getOrder(another.id)).status, "PENDING_PAYMENT");
        assert.equal((await POST(request(obj, hmac))).status, 200);
        assert.equal((await POST(request(obj, hmac))).status, 200);
        const paid = await getOrder(order.id);
        assert.equal(paid.status, "PAID");
        assert.equal(paid.items[0].ledger.length, 1);
        assert.equal((await getOrder(paidId)).items[0].ledger.length, 1);
      },
    );
  } finally {
    if (users.length) {
      await db.ledgerEntry.deleteMany({
        where: { seller: { userId: { in: users } } },
      });
      await db.order.deleteMany({ where: { buyerId: { in: users } } });
      await db.product.deleteMany({ where: { id: { in: products } } });
      await db.coupon.deleteMany({ where: { id: { in: coupons } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
    }
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    await db.$disconnect();
  }
});
