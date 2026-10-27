import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

test("catalog search against PostgreSQL", async (t) => {
  assert.ok(process.env.TEST_DATABASE_URL, "Set TEST_DATABASE_URL");
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const { db } = await import("../../src/lib/db");
  const { searchProductIds } = await import("../../src/lib/search");
  const key = randomUUID();
  const users: string[] = [];
  let categoryId = "";
  try {
    const make = async (name: string, kycStatus: "APPROVED" | "PENDING") => {
      const u = await db.user.create({
        data: {
          email: `${key}-${name}@test.local`,
          name,
          passwordHash: "test-only",
          role: "SELLER",
          seller: { create: { storeName: `متجر ${name}`, slug: `${key}-${name}`, type: "COMPANY", kycStatus } },
        },
        include: { seller: true },
      });
      users.push(u.id);
      return u.seller!;
    };
    const good = await make("good", "APPROVED");
    const pending = await make("pending", "PENDING");
    categoryId = (
      await db.category.create({ data: { slug: key, nameAr: `ذكاء ${key}`, nameEn: "AI", commissionBps: 1000 } })
    ).id;
    const product = (sellerId: string, n: string, title: string, description: string, soldCount = 0) =>
      db.product.create({
        data: {
          sellerId,
          categoryId,
          slug: `${key}-${n}`,
          title: `${title} ${key}`,
          description,
          price: 10000,
          deliveryType: "TEXT",
          deliveryContent: "x",
          status: "ACTIVE",
          soldCount,
        },
      });
    const gpt = await product(good.id, "gpt", "اشتراك ChatGPT Plus شهر", "حساب خاص");
    const mention = await product(good.id, "mention", "حزمة أدوات", "فيها chatgpt كمان", 99);
    const capcut = await product(good.id, "capcut", "CapCut Pro سنة", "تعديل فيديو");
    await product(pending.id, "hidden", "ChatGPT من تاجر مش موثق", "x");

    await t.test("arabic brand names find english titles, title hits first", async () => {
      const ids = await searchProductIds({ q: `شات جي بي تي ${key}` });
      assert.deepEqual(ids, [gpt.id, mention.id]);
    });

    await t.test("all words must match, spelling variants fold", async () => {
      assert.deepEqual(await searchProductIds({ q: `إشتراك بلس ${key}` }), [gpt.id]);
      assert.deepEqual(await searchProductIds({ q: `كاب كات سنه ${key}` }), [capcut.id]);
      assert.deepEqual(await searchProductIds({ q: `نتفليكس ${key}` }), []);
    });

    await t.test("category and store names are searchable, sort and filter apply", async () => {
      const all = await searchProductIds({ q: `ذكاء ${key}`, sort: "popular" });
      assert.equal(all.length, 3);
      assert.equal(all[0], mention.id);
      assert.deepEqual(await searchProductIds({ q: key, categoryIds: ["nope"] }), []);
      assert.equal((await searchProductIds({ q: `متجر good ${key}` })).length, 3);
    });

    await t.test("symbols alone search nothing", async () => {
      assert.deepEqual(await searchProductIds({ q: "%_%" }), []);
    });
  } finally {
    await db.product.deleteMany({ where: { categoryId } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    await db.$disconnect();
  }
});
