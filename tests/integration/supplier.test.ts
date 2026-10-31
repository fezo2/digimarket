import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

// Resale through a fake ProdSeller: buy on payment, retry safely, stop on a
// refused purchase until an admin retries.
test("ProdSeller resale against PostgreSQL", async (t) => {
  assert.ok(process.env.TEST_DATABASE_URL, "Set TEST_DATABASE_URL");
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.PRODSELLER_API_KEY = "psk_test";
  process.env.PRODSELLER_API_URL = "https://supplier.test/v1";
  const { db } = await import("../../src/lib/db");
  const { createOrder, markOrderPaid } = await import("../../src/lib/orders");
  const {
    runSupplierJob,
    importSupplierProducts,
    saveSupplierSettings,
    recategorizeSupplierProducts,
  } = await import("../../src/lib/supplier");
  const { redeliverOrder } = await import("../../src/lib/wallet");

  const key = randomUUID();
  const users: string[] = [];
  let categoryId = "";
  const originalFetch = globalThis.fetch;
  const calls: { path: string; idem: string | null; body: unknown }[] = [];
  let mode: "ok" | "broke" | "down" = "ok";
  let stock = 5;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const path = String(url).replace("https://supplier.test/v1", "");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("X-API-Key"), "psk_test");
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status });
    if (path === "/products")
      return json({
        products: [
          { id: "p1", name: "ChatGPT Plus 1 Month", description: "Shared account, one month", price: 2, inStock: true },
          { id: "p2", name: "Activation thing", price: 3, inStock: true, requiresEmailActivation: true },
        ],
      });
    if (path === "/products/p1") return json({ id: "p1", name: "x", price: 2, stock });
    if (path === "/balance") return json({ balance: 10 });
    if (path === "/orders" && init?.method === "POST") {
      calls.push({ path, idem: headers.get("Idempotency-Key"), body: JSON.parse(String(init.body)) });
      if (mode === "down") throw new TypeError("network");
      if (mode === "broke") return json({ error: "Solde insuffisant" }, 402);
      const qty = (JSON.parse(String(init.body)) as { quantity: number }).quantity;
      return json({
        orderId: "so-" + calls.length,
        status: "delivered",
        deliveredKeys: Array.from({ length: qty }, (_, i) => `user${i}:pass`),
      });
    }
    return json({ error: "not found" }, 404);
  }) as typeof fetch;

  try {
    const admin = await db.user.create({
      data: { email: `${key}-admin@test.local`, name: "admin", passwordHash: "x", role: "ADMIN" },
    });
    users.push(admin.id);
    const buyer = await db.user.create({
      data: { email: `${key}-buyer@test.local`, name: "buyer", passwordHash: "x" },
    });
    users.push(buyer.id);
    const sellerUser = await db.user.create({
      data: {
        email: `${key}-seller@test.local`,
        name: "seller",
        passwordHash: "x",
        role: "SELLER",
        seller: { create: { storeName: "cloud", slug: key, type: "COMPANY", kycStatus: "APPROVED" } },
      },
      include: { seller: true },
    });
    users.push(sellerUser.id);
    const category = await db.category.create({
      data: { slug: key, nameAr: "اختبار", nameEn: "Test", commissionBps: 1000 },
    });
    categoryId = category.id;

    await saveSupplierSettings(admin.id, {
      sellerId: sellerUser.seller!.id,
      usdRate: 55,
      multiplier: 2.5,
    });
    assert.equal(
      await importSupplierProducts(admin.id, [
        { id: "p1", categoryId },
        { id: "p2", categoryId },
      ]),
      1,
      "activation products are skipped",
    );
    const product = await db.product.findFirstOrThrow({
      where: { supplier: "prodseller", supplierProductId: "p1" },
    });
    assert.equal(product.price, 27500); // $2 × 55 × 2.5
    assert.equal(product.status, "ACTIVE");

    const buy = async (quantity: number, ref: string) => {
      const order = await createOrder({
        buyerId: buyer.id,
        productId: product.id,
        quantity,
        selections: {},
        textInputs: {},
      });
      const total = (await db.order.findUniqueOrThrow({ where: { id: order.id } })).total;
      await markOrderPaid(order.id, { provider: "test", reference: ref, amount: total });
      return db.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: { include: { stockItems: true, ledger: true } } },
      });
    };

    await t.test("paid order is bought and delivered at once", async () => {
      const o = await buy(2, key + "-1");
      const item = o.items[0];
      assert.ok(item.deliveredAt);
      assert.equal(item.supplierOrderId, "so-1");
      assert.deepEqual(
        item.stockItems.map((s) => s.status),
        ["SOLD", "SOLD"],
      );
      assert.equal(item.ledger.length, 1);
      assert.equal(calls[0].idem, `digiegy-${item.id}-0`);
    });

    await t.test("more than the supplier's stock is refused at checkout", async () => {
      stock = 1;
      await assert.rejects(
        createOrder({ buyerId: buyer.id, productId: product.id, quantity: 2, selections: {}, textInputs: {} }),
        /الكمية المتاحة/,
      );
      stock = 5;
    });

    await t.test("network error: the job retries with the same key", async () => {
      mode = "down";
      const o = await buy(1, key + "-2");
      assert.equal(o.items[0].deliveredAt, null);
      const idem = calls.at(-1)!.idem;
      mode = "ok";
      await runSupplierJob();
      const item = await db.orderItem.findUniqueOrThrow({ where: { id: o.items[0].id } });
      assert.ok(item.deliveredAt);
      assert.equal(calls.at(-1)!.idem, idem);
    });

    await t.test("no balance: held for the admin, who retries with a new key", async () => {
      mode = "broke";
      const o = await buy(1, key + "-3");
      const failed = await db.order.findUniqueOrThrow({
        where: { id: o.id },
        include: { items: true },
      });
      assert.match(failed.reviewReason ?? "", /Solde insuffisant/);
      assert.equal(failed.items[0].supplierAttempt, 1);
      const before = calls.length;
      await runSupplierJob();
      assert.equal(calls.length, before, "the job does not retry a refused purchase");
      mode = "ok";
      assert.equal(await redeliverOrder(admin.id, o.id), true);
      assert.equal(calls.at(-1)!.idem, `digiegy-${failed.items[0].id}-1`);
      const done = await db.order.findUniqueOrThrow({
        where: { id: o.id },
        include: { items: true },
      });
      assert.ok(done.items[0].deliveredAt);
      assert.equal(done.reviewReason, null);
    });

    await t.test("settings change re-prices imported products", async () => {
      await saveSupplierSettings(admin.id, {
        sellerId: sellerUser.seller!.id,
        usdRate: 50,
        multiplier: 2,
      });
      const p = await db.product.findUniqueOrThrow({ where: { id: product.id } });
      assert.equal(p.price, 20000);
    });
    await t.test("recategorize moves products to the category their name points to", async () => {
      // The category tree comes from a migration, so it exists in every test DB.
      const chatgpt = await db.category.findUniqueOrThrow({ where: { slug: "chatgpt" } });
      assert.ok(await recategorizeSupplierProducts(admin.id) >= 1);
      const p = await db.product.findUniqueOrThrow({ where: { id: product.id } });
      assert.equal(p.categoryId, chatgpt.id);
      assert.equal(await recategorizeSupplierProducts(admin.id), 0);
    });
  } finally {
    globalThis.fetch = originalFetch;
    await db.supplierSettings.deleteMany({ where: { id: "prodseller" } });
    if (users.length) {
      await db.ledgerEntry.deleteMany({ where: { seller: { userId: { in: users } } } });
      await db.order.deleteMany({ where: { buyerId: { in: users } } });
      await db.product.deleteMany({ where: { seller: { userId: { in: users } } } });
      await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
    }
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    await db.$disconnect();
  }
});
