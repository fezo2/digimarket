import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
test("launch accounts, Telegram, event transactions and cron security", async (t) => {
  assert.ok(process.env.TEST_DATABASE_URL);
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const { db } = await import("../../src/lib/db");
  const {
    authenticate,
    requestPasswordReset,
    resetPassword,
    sessionIsCurrent,
    changePassword,
  } = await import("../../src/lib/account-security");
  const { tokenHash } = await import("../../src/lib/security");
  const { createTelegramLink, telegramWebhook } =
    await import("../../src/lib/telegram");
  const { enqueueNotice, sendNotifications } =
    await import("../../src/lib/notifications");
  const { cronAuthorization, cleanupBatch } =
    await import("../../src/lib/jobs");
  const { createOrder, markOrderPaid } = await import("../../src/lib/orders");
  const { sendMessage } = await import("../../src/lib/chat");
  const { openDispute, resolveDispute } =
    await import("../../src/lib/disputes");
  const { moderateProduct } = await import("../../src/lib/product-moderation");
  const { requestPayout, processPayout } = await import("../../src/lib/wallet");
  const key = randomUUID();
  const ids: string[] = [];
  let sellerId = "",
    productId = "",
    orderId = "",
    categoryId = "";
  const previous = {
    token: process.env.TELEGRAM_BOT_TOKEN,
    username: process.env.TELEGRAM_BOT_USERNAME,
    secret: process.env.TELEGRAM_WEBHOOK_SECRET,
    cron: process.env.CRON_SECRET,
  };
  process.env.TELEGRAM_BOT_TOKEN = "fake-bot-token";
  process.env.TELEGRAM_BOT_USERNAME = "fake_bot";
  process.env.TELEGRAM_WEBHOOK_SECRET = "fake-secret";
  process.env.CRON_SECRET = "fake-cron";
  const delivered: string[] = [];
  const okFetch = (async (_url: unknown, options: RequestInit) => {
    delivered.push(String(options.body));
    return Response.json({ ok: true });
  }) as typeof fetch;
  try {
    const passwordHash = await bcrypt.hash("password123", 4);
    const buyer = await db.user.create({
      data: { email: key + "@test.local", name: "Buyer", passwordHash },
    });
    ids.push(buyer.id);
    const admin = await db.user.create({
      data: {
        email: key + "-admin@test.local",
        name: "Admin",
        passwordHash,
        role: "ADMIN",
      },
    });
    ids.push(admin.id);
    const seller = await db.user.create({
      data: {
        email: key + "-seller@test.local",
        name: "Seller",
        passwordHash,
        role: "SELLER",
        seller: {
          create: {
            slug: key,
            storeName: "Test",
            kycStatus: "APPROVED",
            payoutMethod: "INSTAPAY",
            payoutAccount: "private-account",
            payoutHolderName: "Seller",
            payoutUpdatedAt: new Date(Date.now() - 86400001),
          },
        },
      },
      include: { seller: true },
    });
    ids.push(seller.id);
    sellerId = seller.seller!.id;
    await t.test(
      "email and IP limits, successful login clears only email failures",
      async () => {
        assert.equal(
          await authenticate(buyer.email, "wrong", key + "-ip"),
          null,
        );
        assert.ok(await authenticate(buyer.email, "password123", key + "-ip"));
        assert.equal(
          await db.loginAttempt.count({
            where: { key: "login-email:" + tokenHash(buyer.email) },
          }),
          0,
        );
        for (let i = 0; i < 5; i++)
          assert.equal(
            await authenticate(buyer.email, "wrong", key + "-ip"),
            null,
          );
        await assert.rejects(
          authenticate(buyer.email, "wrong", key + "-ip"),
          /محاولات كتير/,
        );
        for (let i = 0; i < 20; i++)
          assert.equal(
            await authenticate(
              key + "-" + i + "@test.local",
              "wrong",
              key + "-shared-ip",
            ),
            null,
          );
        await assert.rejects(
          authenticate(key + "-other@test.local", "wrong", key + "-shared-ip"),
          /محاولات كتير/,
        );
      },
    );
    await t.test(
      "reset hash, expiry, single-use, request limit, session invalidation and payout lock",
      async () => {
        const links: string[] = [];
        const send = async (_email: string, url: string) => {
          links.push(url);
        };
        for (let i = 0; i < 4; i++)
          await requestPasswordReset(seller.email, send);
        assert.equal(links.length, 3);
        const raw = new URL(links[0]).searchParams.get("token")!;
        const row = await db.passwordResetToken.findUniqueOrThrow({
          where: { tokenHash: tokenHash(raw) },
        });
        assert.notEqual(row.tokenHash, raw);
        assert.ok(!JSON.stringify(row).includes(raw));
        await db.passwordResetToken.update({
          where: { id: row.id },
          data: { expiresAt: new Date(Date.now() - 1) },
        });
        await assert.rejects(resetPassword(raw, "new-password"));
        const valid = new URL(links[1]).searchParams.get("token")!;
        const outcomes = await Promise.allSettled([
          resetPassword(valid, "new-password"),
          resetPassword(valid, "new-password"),
        ]);
        assert.equal(
          outcomes.filter((r) => r.status === "fulfilled").length,
          1,
        );
        const updated = await db.user.findUniqueOrThrow({
          where: { id: seller.id },
        });
        assert.equal(updated.sessionVersion, 1);
        assert.ok(!sessionIsCurrent(0, updated.sessionVersion));
        assert.ok(sessionIsCurrent(1, updated.sessionVersion));
        assert.equal(
          await db.passwordResetToken.count({ where: { userId: seller.id } }),
          1,
        );
        assert.ok(
          (
            await db.sellerProfile.findUniqueOrThrow({
              where: { id: sellerId },
            })
          ).payoutUpdatedAt!.getTime() >
            Date.now() - 10000,
        );
        await changePassword(seller.id, "new-password", "changed-password");
        assert.equal(
          (await db.user.findUniqueOrThrow({ where: { id: seller.id } }))
            .sessionVersion,
          2,
        );
      },
    );
    await t.test(
      "Telegram secret, private chat, expiry and single use",
      async () => {
        const link = await createTelegramLink(sellerId);
        const token = new URL(link).searchParams.get("start")!;
        const payload = {
          message: {
            text: "/start " + token,
            chat: { id: 123, type: "private" },
          },
        };
        assert.equal(await telegramWebhook("wrong", payload, okFetch), 401);
        assert.equal(
          await telegramWebhook(
            "fake-secret",
            {
              message: { ...payload.message, chat: { id: 123, type: "group" } },
            },
            okFetch,
          ),
          200,
        );
        assert.equal(
          (await db.telegramLinkToken.findUniqueOrThrow({ where: { token } }))
            .usedAt,
          null,
        );
        assert.equal(
          await telegramWebhook("fake-secret", payload, okFetch),
          200,
        );
        await telegramWebhook(
          "fake-secret",
          {
            message: { ...payload.message, chat: { id: 456, type: "private" } },
          },
          okFetch,
        );
        assert.equal(
          (
            await db.sellerProfile.findUniqueOrThrow({
              where: { id: sellerId },
            })
          ).telegramChatId,
          "123",
        );
        assert.equal(delivered.length, 1);
        const expired = new URL(
          await createTelegramLink(sellerId),
        ).searchParams.get("start")!;
        await db.telegramLinkToken.update({
          where: { token: expired },
          data: { expiresAt: new Date(Date.now() - 1) },
        });
        await telegramWebhook(
          "fake-secret",
          {
            message: {
              text: "/start " + expired,
              chat: { id: 456, type: "private" },
            },
          },
          okFetch,
        );
        assert.equal(
          (
            await db.sellerProfile.findUniqueOrThrow({
              where: { id: sellerId },
            })
          ).telegramChatId,
          "123",
        );
      },
    );
    await t.test(
      "notifications commit with sale, chat, dispute and payout; rollback and privacy",
      async () => {
        categoryId = (
          await db.category.create({
            data: { slug: key, nameAr: "اختبار", nameEn: "Test" },
          })
        ).id;
        productId = (
          await db.product.create({
            data: {
              sellerId,
              categoryId,
              slug: key,
              title: "Test product",
              description: "Test",
              price: 20000,
              deliveryType: "UNIQUE_CODES",
              status: "ACTIVE",
              stock: { create: [{ content: "SECRET-CODE" }] },
            },
          })
        ).id;
        const order = await createOrder({
          buyerId: buyer.id,
          productId,
          quantity: 1,
          selections: {},
          textInputs: {},
        });
        orderId = order.id;
        await markOrderPaid(orderId, {
          provider: "test",
          reference: key,
          amount: 20000,
        });
        await markOrderPaid(orderId, {
          provider: "test",
          reference: key,
          amount: 20000,
        });
        await sendMessage(buyer.id, orderId, "private buyer text");
        const item = await db.orderItem.findFirstOrThrow({
          where: { orderId },
        });
        const dispute = await openDispute(
          buyer.id,
          item.id,
          "المنتج مش شغال ومحتاج مساعدة من التاجر",
        );
        await resolveDispute(admin.id, dispute, false, "checked");
        await db.sellerProfile.update({
          where: { id: sellerId },
          data: { payoutUpdatedAt: new Date(Date.now() - 86400001) },
        });
        await db.ledgerEntry.updateMany({
          where: { sellerId, type: "SALE" },
          data: { availableAt: new Date(Date.now() - 1) },
        });
        const payout = await requestPayout(seller.id, 10000);
        await processPayout(admin.id, payout, "REJECTED", "reason");
        const paidPayout = await requestPayout(seller.id, 10000);
        await processPayout(admin.id, paidPayout, "PAID", "test-reference");
        await db.product.update({
          where: { id: productId },
          data: { status: "PENDING_REVIEW" },
        });
        await moderateProduct(admin.id, {
          id: productId,
          decision: "ACTIVE",
          reviewNote: "",
        });
        await db.product.update({
          where: { id: productId },
          data: { status: "PENDING_REVIEW" },
        });
        await moderateProduct(admin.id, {
          id: productId,
          decision: "REJECTED",
          reviewNote: "test",
        });
        const events = await db.notification.findMany({ where: { sellerId } });
        for (const name of [
          "sale",
          "stock.low",
          "chat",
          "dispute.opened",
          "dispute.resolved",
          "payout.rejected",
          "payout.paid",
          "product.approved",
          "product.rejected",
        ])
          assert.equal(events.filter((n) => n.event === name).length, 1);
        assert.ok(!JSON.stringify(events).includes("SECRET-CODE"));
        assert.ok(!JSON.stringify(events).includes("private buyer text"));
        assert.ok(!JSON.stringify(events).includes("private-account"));
        const before = events.length;
        await assert.rejects(
          db.$transaction(async (tx) => {
            await enqueueNotice(tx, sellerId, "sale", {});
            throw Error("rollback");
          }),
        );
        assert.equal(
          await db.notification.count({ where: { sellerId } }),
          before,
        );
      },
    );
    await t.test(
      "sender retries 1/5/30/120 minutes, fails after five, handles 403",
      async () => {
        await sendNotifications(okFetch);
        assert.equal(
          await db.notification.count({
            where: { sellerId, status: "PENDING" },
          }),
          0,
        );
        await db.$transaction((tx) => enqueueNotice(tx, sellerId, "chat", {}));
        const n = await db.notification.findFirstOrThrow({
          where: { sellerId, status: "PENDING" },
        });
        const badFetch = (async () =>
          Response.json({ ok: false }, { status: 500 })) as typeof fetch;
        for (let attempt = 1; attempt <= 5; attempt++) {
          await db.notification.update({
            where: { id: n.id },
            data: { nextAttemptAt: new Date(Date.now() - 1) },
          });
          const before = Date.now();
          await sendNotifications(badFetch);
          const after = await db.notification.findUniqueOrThrow({
            where: { id: n.id },
          });
          assert.equal(after.attempts, attempt);
          assert.equal(after.status, attempt === 5 ? "FAILED" : "PENDING");
          if (attempt < 5)
            assert.ok(
              after.nextAttemptAt.getTime() >=
                before + [1, 5, 30, 120][attempt - 1] * 60000,
            );
        }
        await db.$transaction((tx) => enqueueNotice(tx, sellerId, "chat", {}));
        await sendNotifications((async () =>
          Response.json(
            { ok: false, error_code: 403 },
            { status: 403 },
          )) as typeof fetch);
        assert.equal(
          (
            await db.sellerProfile.findUniqueOrThrow({
              where: { id: sellerId },
            })
          ).telegramChatId,
          null,
        );
      },
    );
    await t.test("cron secrets and bounded cleanup", async () => {
      assert.equal(cronAuthorization("unknown", "Bearer fake-cron"), 404);
      assert.equal(cronAuthorization("cleanup", "wrong"), 401);
      assert.equal(cronAuthorization("cleanup", "Bearer fake-cron"), 200);
      await db.orderRead.upsert({
        where: { orderId_userId: { orderId, userId: buyer.id } },
        create: { orderId, userId: buyer.id, lastReadAt: new Date() },
        update: {},
      });
      await db.order.update({
        where: { id: orderId },
        data: { createdAt: new Date(Date.now() - 181 * 86400000) },
      });
      const { GET } = await import("../../src/app/api/cron/[job]/route");
      assert.equal(
        (
          await GET(
            new Request("https://example.test/api/cron/cleanup", {
              headers: { authorization: "wrong" },
            }),
            { params: Promise.resolve({ job: "cleanup" }) },
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await GET(
            new Request("https://example.test/api/cron/cleanup", {
              headers: { authorization: "Bearer fake-cron" },
            }),
            { params: Promise.resolve({ job: "cleanup" }) },
          )
        ).status,
        200,
      );
      await cleanupBatch();
      assert.equal(await db.orderRead.count({ where: { orderId } }), 0);
    });
  } finally {
    if (orderId) await db.orderRead.deleteMany({ where: { orderId } });
    await db.notification.deleteMany({ where: { sellerId } });
    await db.telegramLinkToken.deleteMany({ where: { sellerId } });
    await db.passwordResetToken.deleteMany({ where: { userId: { in: ids } } });
    await db.loginAttempt.deleteMany({
      where: {
        OR: [
          {
            key: {
              in: ["login-email:", "reset:"].flatMap((prefix) =>
                [
                  key + "@test.local",
                  key + "-seller@test.local",
                  ...Array.from(
                    { length: 20 },
                    (_, i) => key + "-" + i + "@test.local",
                  ),
                ].map((email) => prefix + tokenHash(email)),
              ),
            },
          },
          {
            key: {
              in: [
                "login-ip:" + tokenHash(key + "-ip"),
                "login-ip:" + tokenHash(key + "-shared-ip"),
              ],
            },
          },
        ],
      },
    });
    await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await db.ledgerEntry.deleteMany({ where: { sellerId } });
    await db.payout.deleteMany({ where: { sellerId } });
    if (orderId) await db.order.delete({ where: { id: orderId } });
    if (productId) await db.product.delete({ where: { id: productId } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    for (const [name, value] of Object.entries({
      TELEGRAM_BOT_TOKEN: previous.token,
      TELEGRAM_BOT_USERNAME: previous.username,
      TELEGRAM_WEBHOOK_SECRET: previous.secret,
      CRON_SECRET: previous.cron,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await db.$disconnect();
  }
});
