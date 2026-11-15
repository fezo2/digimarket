import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

test("abandoned checkout reminders against PostgreSQL", async (t) => {
  assert.ok(process.env.TEST_DATABASE_URL, "Set TEST_DATABASE_URL");
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.AUTH_SECRET ??= "test-secret-".padEnd(40, "x");
  const { db } = await import("../../src/lib/db");
  const { sendCheckoutReminders, saveReminderSettings, reminderStats } =
    await import("../../src/lib/checkout-reminders");
  const { unsubscribeToken } = await import("../../src/lib/checkout-reminder-text");
  const { POST } = await import("../../src/app/api/unsubscribe/route");
  const key = randomUUID();
  const users: string[] = [];
  let categoryId = "";
  let productId = "";
  const now = new Date();
  const ago = (min: number) => new Date(now.getTime() - min * 60000);
  try {
    const sellerUser = await db.user.create({
      data: {
        email: `${key}-seller@test.local`,
        name: "تاجر",
        passwordHash: "x",
        role: "SELLER",
        seller: { create: { storeName: "متجر", slug: key, kycStatus: "APPROVED" } },
      },
      include: { seller: true },
    });
    users.push(sellerUser.id);
    categoryId = (
      await db.category.create({
        data: { slug: key, nameAr: "اختبار", nameEn: "Test", commissionBps: 1000 },
      })
    ).id;
    productId = (
      await db.product.create({
        data: {
          sellerId: sellerUser.seller!.id,
          categoryId,
          slug: key,
          title: "منتج التذكير",
          description: "وصف",
          status: "ACTIVE",
          price: 10000,
          deliveryType: "UNIQUE_CODES",
        },
      })
    ).id;
    const buyer = async (name: string, extra: object = {}) => {
      const u = await db.user.create({
        data: { email: `${key}-${name}@test.local`, name, passwordHash: "x", ...extra },
      });
      users.push(u.id);
      return u;
    };
    const order = (buyerId: string, minutesAgo: number, status = "CANCELLED", paid = false) =>
      db.order.create({
        data: {
          buyerId,
          status: status as "CANCELLED",
          subtotal: 10000,
          total: 10000,
          createdAt: ago(minutesAgo),
          expiresAt: ago(minutesAgo - 30),
          paidAt: paid ? ago(minutesAgo - 5) : null,
          items: {
            create: {
              productId,
              sellerId: sellerUser.seller!.id,
              title: "منتج التذكير",
              quantity: 1,
              unitPrice: 10000,
              total: 10000,
              commissionBps: 1000,
              commissionAmount: 1000,
              sellerNet: 9000,
              deliveryType: "UNIQUE_CODES",
            },
          },
        },
      });

    const a = await buyer("a");
    const aOld = await order(a.id, 300);
    const aNew = await order(a.id, 120);
    const b = await buyer("b");
    await order(b.id, 180);
    await order(b.id, 90, "PAID", true); // came back and paid
    const c = await buyer("c", { checkoutRemindersOffAt: new Date() });
    await order(c.id, 120);
    const d = await buyer("d");
    await order(d.id, 40); // still inside the 60 minute delay
    const e = await buyer("e");
    await order(e.id, 3 * 24 * 60); // too old
    const f = await buyer("f");
    const fOrder = await order(f.id, 120);

    const mails: { to: string; text: string; headers?: Record<string, string> }[] = [];
    let failFor = f.email;
    const deps = {
      email: async (to: string, _s: string, text: string, headers?: Record<string, string>) => {
        if (to === failFor) throw new Error("down");
        mails.push({ to, text, headers });
      },
      telegram: async () => {},
    };

    await t.test("one reminder per buyer, only for real abandoned checkouts", async () => {
      await sendCheckoutReminders(now, deps);
      const to = mails.map((m) => m.to).filter((m) => m.startsWith(key));
      assert.deepEqual(to, [a.email]);
      assert.match(mails[0].text, new RegExp(`/products/${key}`));
      assert.match(mails[0].headers!["List-Unsubscribe"], /api\/unsubscribe\?u=/);
      const aOrders = await db.order.findMany({ where: { buyerId: a.id }, orderBy: { createdAt: "asc" } });
      assert.equal(aOrders[0].id, aOld.id);
      assert.equal(aOrders[0].reminderSentAt, null);
      assert.ok(aOrders[1].reminderSentAt && aOrders[1].id === aNew.id);
      // A failed email is released for the next run.
      assert.equal((await db.order.findUnique({ where: { id: fOrder.id } }))!.reminderSentAt, null);
    });

    await t.test("no second reminder, and the failed one is retried", async () => {
      mails.length = 0;
      failFor = "";
      await sendCheckoutReminders(now, deps);
      assert.deepEqual(mails.map((m) => m.to).filter((m) => m.startsWith(key)), [f.email]);
      mails.length = 0;
      await sendCheckoutReminders(now, deps);
      assert.deepEqual(mails.filter((m) => m.to.startsWith(key)), []);
      assert.ok((await reminderStats(7, now)).sent >= 2);
    });

    await t.test("admin switch turns reminders off", async () => {
      const g = await buyer("g");
      await order(g.id, 120);
      await saveReminderSettings(sellerUser.id, { enabled: false, delayMinutes: 60 });
      mails.length = 0;
      await sendCheckoutReminders(now, deps);
      assert.equal(mails.length, 0);
      await saveReminderSettings(sellerUser.id, { enabled: true, delayMinutes: 60 });
      await sendCheckoutReminders(now, deps);
      assert.deepEqual(mails.map((m) => m.to).filter((m) => m.startsWith(key)), [g.email]);
    });

    await t.test("one-click unsubscribe needs a valid token", async () => {
      const h = await buyer("h");
      const bad = await POST(new Request(`http://x/api/unsubscribe?u=${h.id}&t=${"0".repeat(64)}`, { method: "POST" }));
      assert.equal(bad.status, 400);
      const ok = await POST(
        new Request(`http://x/api/unsubscribe?u=${h.id}&t=${unsubscribeToken(h.id, process.env.AUTH_SECRET!)}`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: "List-Unsubscribe=One-Click",
        }),
      );
      assert.equal(ok.status, 200);
      assert.ok((await db.user.findUnique({ where: { id: h.id } }))!.checkoutRemindersOffAt);
    });
  } finally {
    await db.checkoutReminderSettings.deleteMany({});
    await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await db.order.deleteMany({ where: { buyerId: { in: users } } });
    if (productId) await db.product.delete({ where: { id: productId } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    await db.$disconnect();
  }
});
