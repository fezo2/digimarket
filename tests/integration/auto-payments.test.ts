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
test("automatic InstaPay / wallet confirmation from forwarded SMS", async (t) => {
  assert.ok(
    process.env.TEST_DATABASE_URL,
    "Set TEST_DATABASE_URL to an isolated, migrated test database",
  );
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const storage = await mkdtemp(path.join(tmpdir(), "dm-receipts-"));
  process.env.STORAGE_DIR = storage;
  delete process.env.STORAGE_DRIVER;
  const { db } = await import("../../src/lib/db");
  const { createOrder, preparePayment } =
    await import("../../src/lib/orders");
  process.env.MANUAL_WALLET = "01000000001";
  process.env.SMS_WEBHOOK_SECRET = "test-secret";
  delete process.env.SMS_ALLOWED_SENDERS;
  const { startAutoPayment, handlePaymentNotice } = await import(
    "../../src/lib/auto-payments"
  );
  const { submitManualPayment } = await import("../../src/lib/manual-payments");
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

    await t.test("unique amount confirms and delivers the order", async () => {
      const order = await newOrder();
      const started = await startAutoPayment(order.id, order.buyerId, "+20 101 234 5678");
      assert.equal(started.payFrom, "01012345678");
      assert.ok(started.payAmount! > order.total && started.payAmount! < order.total + 100);
      const amount = (started.payAmount! / 100).toFixed(2);
      const r = await handlePaymentNotice({
        sender: "VF-Cash",
        text: `تم استلام مبلغ ${amount} جنيه من رقم 01299999999. رصيدك الحالي 5000.00 جنيه`,
      });
      assert.equal(r.status, "MATCHED");
      const paid = await load(order.id);
      assert.equal(paid.status, "PAID");
      assert.equal(paid.paidAmount, order.total);
      assert.ok(paid.items[0].deliveredAt);
      // The same SMS forwarded again does nothing more.
      const again = await handlePaymentNotice({
        sender: "VF-Cash",
        text: `تم استلام مبلغ ${amount} جنيه من رقم 01299999999. رصيدك الحالي 5000.00 جنيه`,
      });
      assert.equal(again.status, "DUPLICATE");
    });

    await t.test("rounded amount matches by the buyer's number and closes a submitted receipt", async () => {
      const order = await newOrder();
      await startAutoPayment(order.id, order.buyerId, "01155555555");
      await submitManualPayment(order.buyerId, order.id, details("REF-AUTO01"), png());
      const r = await handlePaymentNotice({
        text: "تم استلام مبلغ 100 جنيه من رقم 01155555555 رقم العملية 778899",
      });
      assert.equal(r.status, "MATCHED");
      const paid = await load(order.id);
      assert.equal(paid.status, "PAID");
      assert.equal(paid.manualPayment?.status, "CONFIRMED");
    });

    await t.test("outgoing, unknown and the platform's own number are refused", async () => {
      const order = await newOrder();
      await assert.rejects(startAutoPayment(order.id, order.buyerId, "01000000001"), /الاستلام/);
      await assert.rejects(startAutoPayment(order.id, order.buyerId, "hello"), /رقم موبايل/);
      await startAutoPayment(order.id, order.buyerId, "01066666666");
      const out = await handlePaymentNotice({
        text: "تم تحويل مبلغ 100 جنيه إلى رقم 01066666666",
      });
      assert.equal(out.status, "IGNORED");
      const unknown = await handlePaymentNotice({
        text: "تم استلام مبلغ 77.77 جنيه من رقم 01077777777",
      });
      assert.equal(unknown.status, "UNMATCHED");
      assert.equal((await load(order.id)).status, "PENDING_PAYMENT");
    });

    await t.test("above the auto-confirm limit waits for the admin", async () => {
      process.env.AUTO_CONFIRM_MAX_EGP = "50";
      try {
        const order = await newOrder();
        const s = await startAutoPayment(order.id, order.buyerId, "01088888888");
        const r = await handlePaymentNotice({
          text: `استلمت ${(s.payAmount! / 100).toFixed(2)} جنيه`,
        });
        assert.equal(r.status, "UNMATCHED");
        assert.equal((await load(order.id)).status, "PENDING_PAYMENT");
      } finally {
        delete process.env.AUTO_CONFIRM_MAX_EGP;
      }
    });
  } finally {
    if (users.length) {
      await db.ledgerEntry.deleteMany({
        where: { seller: { userId: { in: users } } },
      });
      await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
      await db.paymentNotice.deleteMany({});
      await db.order.deleteMany({ where: { buyerId: { in: users } } });
      await db.product.deleteMany({ where: { categoryId } });
      await db.user.deleteMany({ where: { id: { in: users } } });
    }
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    await db.$disconnect();
    await rm(storage, { recursive: true, force: true });
  }
});
