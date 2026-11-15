import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

test("seller store categories against PostgreSQL", async () => {
  assert.ok(process.env.TEST_DATABASE_URL, "Set TEST_DATABASE_URL to an isolated, migrated test database");
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const { db } = await import("../../src/lib/db");
  const sc = await import("../../src/lib/store-categories");
  const { SellerToolError } = await import("../../src/lib/seller-tools");
  const key = randomUUID();
  const users: string[] = [];
  let categoryId = "";
  try {
    const sellers = [];
    for (const n of ["a", "b"]) {
      const user = await db.user.create({
        data: {
          email: `${key}-${n}@test.local`,
          name: "تاجر",
          passwordHash: "test-only",
          role: "SELLER",
          seller: { create: { storeName: `store ${n}`, slug: `${key}-${n}`, kycStatus: "APPROVED" } },
        },
        include: { seller: true },
      });
      users.push(user.id);
      sellers.push(user.seller!);
    }
    const [a, b] = sellers;
    categoryId = (await db.category.create({ data: { slug: `${key}-c`, nameAr: "قسم", nameEn: "Cat" } })).id;
    const product = await db.product.create({
      data: {
        sellerId: a.id,
        categoryId,
        slug: `${key}-p`,
        title: "منتج",
        description: "وصف المنتج",
        price: 1000,
        deliveryType: "TEXT",
        status: "ACTIVE",
      },
    });

    const x = (await sc.createStoreCategory(a.id, "  اشتراكات  "))!;
    const y = (await sc.createStoreCategory(a.id, "برامج"))!;
    assert.equal(x.name, "اشتراكات");
    await assert.rejects(sc.createStoreCategory(a.id, "برامج"), SellerToolError);
    await assert.rejects(sc.createStoreCategory(a.id, "x"));
    // Another store can reuse the same name.
    await sc.createStoreCategory(b.id, "برامج");

    assert.deepEqual((await sc.listStoreCategories(a.id)).map((c) => c.name), ["اشتراكات", "برامج"]);
    assert.equal(await sc.moveStoreCategory(a.id, y.id, "up"), true);
    assert.equal(await sc.moveStoreCategory(a.id, y.id, "up"), false);
    assert.deepEqual((await sc.listStoreCategories(a.id)).map((c) => c.name), ["برامج", "اشتراكات"]);

    // Another seller can't touch it, or assign it.
    assert.equal(await sc.renameStoreCategory(b.id, x.id, "مسروق"), false);
    assert.equal(await sc.deleteStoreCategory(b.id, x.id), false);
    await assert.rejects(sc.assignStoreCategory(b.id, [product.id], x.id), SellerToolError);
    assert.equal(await sc.assignStoreCategory(b.id, [product.id], null), 0);

    assert.equal(await sc.assignStoreCategory(a.id, [product.id], x.id), 1);
    assert.equal(await sc.renameStoreCategory(a.id, x.id, "اشتراكات AI"), true);
    // Deleting keeps the product, just without a store category.
    assert.equal(await sc.deleteStoreCategory(a.id, x.id), true);
    const after = await db.product.findUniqueOrThrow({ where: { id: product.id } });
    assert.equal(after.storeCategoryId, null);
    assert.equal(after.status, "ACTIVE");
  } finally {
    await db.user.deleteMany({ where: { id: { in: users } } });
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    await db.$disconnect();
  }
});
