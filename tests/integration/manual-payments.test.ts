import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const png = () =>
  new File(
    [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])],
    "receipt.png",
    { type: "image/png" },
  );

// Explicit opt-in: this suite creates and removes only its own fixture rows.
test("manual InstaPay / wallet payments against PostgreSQL", async (t) => {
  assert.ok(
    process.env.TEST_DATABASE_URL,
    "Set TEST_DATABASE_URL to an isolated, migrated test database",
  );
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const storage = await mkdtemp(path.join(tmpdir(), "dm-receipts-"));
  process.env.STORAGE_DIR = storage;
  delete process.env.STORAGE_DRIVER;
  const { db } = await import("../../src/lib/db");
  const { createOrder, preparePayment, releaseExpiredOrders } =
    await import("../../src/lib/orders");
  const { submitManualPayment, confirmManualPayment, rejectManualPayment } =
    await import("../../src/lib/manual-payments");
  const key = randomUUID();
  const users: string[] = [];
  let categoryId = "";
  try {
    const mk = (suffix: string, role: "BUYER" | "ADMIN" = "BUYER") =>
      db.user.create({
        data: {
          email: `${key}-${suffix}@test.local`,
          name: suffix,
          passwordHash: "test-only",
          role,
        },
      });
    const other = await mk("other");
    const admin = await mk("admin", "ADMIN");
    users.push(other.id, admin.id);
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
          },
        },
      },
      include: { seller: true },
    });
    users.push(sellerUser.id);
    const category = await db.category.create({
      data: {
        slug: key,
        nameAr: "اختبار",
        nameEn: "Test",
        commissionBps: 1000,
      },
    });
    categoryId = category.id;
    let n = 0;
    // Each order gets its own buyer: buyers may hold at most 3 unpaid orders.
    const newOrder = async () => {
      const owner = await mk(`buyer-${n}`);
      users.push(owner.id);
      const buyerId = owner.id;
      const product = await db.product.create({
        data: {
          sellerId: sellerUser.seller!.id,
          categoryId,
          slug: `${key}-${n++}`,
          title: "منتج",
          description: "وصف",
          status: "ACTIVE",
          price: 10000,
          deliveryType: "UNIQUE_CODES",
          stock: { create: [{ content: `${key}-${n}-code` }] },
        },
      });
      const order = await createOrder({
        buyerId,
        productId: product.id,
        quantity: 1,
        selections: {},
        textInputs: {},
      });
      await preparePayment(order.id, buyerId, "manual");
      return db.order.findUniqueOrThrow({ where: { id: order.id } });
    };
    const details = (reference: string) => ({
      method: "INSTAPAY",
      senderAccount: "buyer@instapay",
      reference,
    });
    const load = (id: string) =>
      db.order.findUniqueOrThrow({
        where: { id },
        include: {
          manualPayment: true,
          items: { include: { ledger: true, stockItems: true } },
        },
      });

    await t.test(
      "only the buyer can submit, and a receipt is required",
      async () => {
        const order = await newOrder();
        await assert.rejects(
          submitManualPayment(other.id, order.id, details("REF-OWNER1"), png()),
          /الطلب مش موجود/,
        );
        await assert.rejects(
          submitManualPayment(
            order.buyerId,
            order.id,
            details("REF-OWNER1"),
            null,
          ),
          /إيصال/,
        );
        await assert.rejects(
          submitManualPayment(
            order.buyerId,
            order.id,
            details("REF-OWNER1"),
            new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], "x.png", {
              type: "image/png",
            }),
          ),
          /مش مطابق/,
        );
        assert.equal(
          await db.manualPayment.count({ where: { orderId: order.id } }),
          0,
        );
      },
    );

    await t.test(
      "confirm delivers the order with exactly one SALE row",
      async () => {
        const order = await newOrder();
        await submitManualPayment(
          order.buyerId,
          order.id,
          details("ref-ok-001"),
          png(),
        );
        await assert.rejects(
          submitManualPayment(
            order.buyerId,
            order.id,
            details("REF-OK-002"),
            png(),
          ),
          /اتبعتت قبل كده/,
        );
        const payment = (await load(order.id)).manualPayment!;
        assert.equal(payment.reference, "REF-OK-001");
        await assert.rejects(
          confirmManualPayment(order.buyerId, payment.id, order.total, ""),
          /غير مسموح/,
        );
        const results = await Promise.all([
          confirmManualPayment(admin.id, payment.id, order.total, ""),
          confirmManualPayment(admin.id, payment.id, order.total, ""),
        ]);
        assert.equal(results.filter(Boolean).length, 1);
        const paid = await load(order.id);
        assert.equal(paid.status, "PAID");
        assert.equal(paid.paymentRef, "manual:" + payment.id);
        assert.ok(paid.items[0].deliveredAt);
        assert.equal(paid.items[0].ledger.length, 1);
        assert.equal(paid.manualPayment!.status, "CONFIRMED");
        assert.equal(
          await rejectManualPayment(admin.id, payment.id, "late"),
          false,
        );
        assert.equal((await load(order.id)).status, "PAID");
      },
    );

    await t.test("a transfer reference can't be reused", async () => {
      const order = await newOrder();
      await assert.rejects(
        submitManualPayment(
          order.buyerId,
          order.id,
          details("REF-OK-001"),
          png(),
        ),
        /اتستخدم قبل كده/,
      );
      assert.equal((await load(order.id)).manualPayment, null);
    });

    await t.test(
      "a wrong amount leaves the order paid but undelivered",
      async () => {
        const order = await newOrder();
        await submitManualPayment(
          order.buyerId,
          order.id,
          details("REF-SHORT1"),
          png(),
        );
        const payment = (await load(order.id)).manualPayment!;
        await confirmManualPayment(
          admin.id,
          payment.id,
          order.total - 100,
          "ناقص جنيه",
        );
        const paid = await load(order.id);
        assert.equal(paid.status, "PAID");
        assert.equal(paid.items[0].deliveredAt, null);
        assert.equal(paid.items[0].ledger.length, 0);
        assert.ok(paid.reviewReason);
      },
    );

    await t.test(
      "a submitted order doesn't expire; reject cancels and frees stock",
      async () => {
        const order = await newOrder();
        await submitManualPayment(
          order.buyerId,
          order.id,
          details("REF-REJECT"),
          png(),
        );
        await db.order.update({
          where: { id: order.id },
          data: { expiresAt: new Date(Date.now() - 60_000) },
        });
        await releaseExpiredOrders();
        assert.equal((await load(order.id)).status, "PENDING_PAYMENT");
        const payment = (await load(order.id)).manualPayment!;
        await assert.rejects(
          rejectManualPayment(admin.id, payment.id, " "),
          /سبب الرفض/,
        );
        const [rejected, confirmed] = await Promise.allSettled([
          rejectManualPayment(admin.id, payment.id, "التحويل موصلش"),
          confirmManualPayment(admin.id, payment.id, order.total, ""),
        ]);
        const after = await load(order.id);
        if (after.manualPayment!.status === "REJECTED") {
          assert.equal(rejected.status === "fulfilled" && rejected.value, true);
          assert.equal(confirmed.status, "rejected");
          assert.equal(after.status, "CANCELLED");
          assert.ok(after.items[0].stockItems.length === 0);
          assert.equal(
            await db.stockItem.count({
              where: {
                productId: after.items[0].productId,
                status: "AVAILABLE",
              },
            }),
            1,
          );
        } else {
          assert.equal(after.status, "PAID");
          assert.equal(
            rejected.status === "fulfilled" && rejected.value,
            false,
          );
        }
      },
    );

    await t.test("an expired order can't receive a transfer", async () => {
      const order = await newOrder();
      await db.order.update({
        where: { id: order.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await assert.rejects(
        submitManualPayment(
          order.buyerId,
          order.id,
          details("REF-LATE01"),
          png(),
        ),
        /انتهت/,
      );
    });
  } finally {
    if (users.length) {
      await db.ledgerEntry.deleteMany({
        where: { seller: { userId: { in: users } } },
      });
      await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
      await db.order.deleteMany({ where: { buyerId: { in: users } } });
      await db.product.deleteMany({ where: { categoryId } });
      await db.user.deleteMany({ where: { id: { in: users } } });
    }
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    await db.$disconnect();
    await rm(storage, { recursive: true, force: true });
  }
});
