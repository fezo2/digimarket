import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
test("chat, reviews and disputes against PostgreSQL", async (t) => {
  assert.ok(process.env.TEST_DATABASE_URL);
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const { db } = await import("../../src/lib/db");
  const { createOrder, markOrderPaid } = await import("../../src/lib/orders");
  const { sendMessage, readChat, readAttachment, unreadCounts } =
    await import("../../src/lib/chat");
  const { writeReview, replyReview, moderateReview } =
    await import("../../src/lib/reviews");
  const { openDispute, closeDispute, resolveDispute } =
    await import("../../src/lib/disputes");
  const { requestPayout, processPayout, refundOrder } =
    await import("../../src/lib/wallet");
  const { frozenAmount } = await import("../../src/lib/dispute-balance");
  const { sellerBalance } = await import("../../src/lib/ledger");
  const { deletePrivateFile } = await import("../../src/lib/storage");
  const key = randomUUID();
  let serial = 0;
  const userIds: string[] = [],
    sellerIds: string[] = [],
    productIds: string[] = [],
    orderIds: string[] = [];
  let categoryId = "";
  try {
    const buyer = await db.user.create({
      data: {
        email: `${key}-buyer@test.local`,
        name: "Buyer Private Family",
        passwordHash: "test",
      },
    });
    userIds.push(buyer.id);
    const stranger = await db.user.create({
      data: {
        email: `${key}-stranger@test.local`,
        name: "Stranger",
        passwordHash: "test",
      },
    });
    userIds.push(stranger.id);
    const admin = await db.user.create({
      data: {
        email: `${key}-admin@test.local`,
        name: "Admin",
        passwordHash: "test",
        role: "ADMIN",
      },
    });
    userIds.push(admin.id);
    const category = await db.category.create({
      data: {
        slug: key,
        nameAr: "اختبار",
        nameEn: "Test",
        commissionBps: 1000,
      },
    });
    categoryId = category.id;
    async function fixture(deliver = true, owner = buyer.id) {
      const suffix = `${key}-${++serial}`;
      const seller = await db.user.create({
        data: {
          email: suffix + "@test.local",
          name: "Seller",
          passwordHash: "test",
          role: "SELLER",
          seller: {
            create: {
              storeName: "Test",
              slug: suffix,
              kycStatus: "APPROVED",
              payoutMethod: "INSTAPAY",
              payoutAccount: "test@instapay",
              payoutHolderName: "Seller",
              payoutUpdatedAt: new Date(Date.now() - 86400001),
            },
          },
        },
        include: { seller: true },
      });
      userIds.push(seller.id);
      sellerIds.push(seller.seller!.id);
      const product = await db.product.create({
        data: {
          sellerId: seller.seller!.id,
          categoryId,
          slug: suffix,
          title: "Community test",
          description: "Test",
          price: 20000,
          status: "ACTIVE",
          deliveryType: "TEXT",
          deliveryContent: "PRIVATE-CODE-NOT-FOR-CHAT",
        },
      });
      productIds.push(product.id);
      const order = await createOrder({
        buyerId: owner,
        productId: product.id,
        quantity: 1,
        selections: {},
        textInputs: {},
      });
      orderIds.push(order.id);
      if (deliver)
        await markOrderPaid(order.id, {
          provider: "test",
          reference: suffix,
          amount: 20000,
        });
      const item = await db.orderItem.findFirstOrThrow({
        where: { orderId: order.id },
      });
      return { seller, sellerId: seller.seller!.id, product, order, item };
    }
    await t.test(
      "chat participant checks, time window, masking, admin exception and open dispute override",
      async () => {
        const f = await fixture();
        await assert.rejects(
          readChat(stranger.id, f.order.id),
          /الطلب مش موجود/,
        );
        await assert.rejects(
          sendMessage(stranger.id, f.order.id, "unauthorized"),
          /الطلب مش موجود/,
        );
        await sendMessage(
          buyer.id,
          f.order.id,
          "call 01012345678 user@example.com",
        );
        const chat = await readChat(f.seller.id, f.order.id);
        assert.equal(chat.messages[0].body, "call [محذوف] user@example.com");
        assert.equal(chat.messages[0].role, "المشتري");
        assert.equal(
          (await readChat(admin.id, f.order.id)).messages[0].flagged,
          true,
        );
        await sendMessage(admin.id, f.order.id, "01012345678");
        assert.equal(
          (await readChat(buyer.id, f.order.id)).messages[1].body,
          "01012345678",
        );
        await db.order.update({
          where: { id: f.order.id },
          data: { paidAt: new Date(Date.now() - 31 * 86400000) },
        });
        assert.equal((await readChat(buyer.id, f.order.id)).canSend, false);
        await assert.rejects(
          sendMessage(buyer.id, f.order.id, "late"),
          /مدة إرسال/,
        );
        const dispute = await openDispute(
          buyer.id,
          f.item.id,
          "المنتج مش شغال ومحتاج مساعدة من التاجر",
        );
        await sendMessage(buyer.id, f.order.id, "open dispute allows messages");
        await closeDispute(buyer.id, dispute);
        await assert.rejects(
          sendMessage(buyer.id, f.order.id, "late again"),
          /مدة إرسال/,
        );
        const pending = await fixture(false);
        await assert.rejects(
          readChat(buyer.id, pending.order.id),
          /الطلب مش موجود/,
        );
      },
    );
    await t.test(
      "twentieth concurrent message succeeds, twenty-first is refused; unread marks only the reader",
      async () => {
        const f = await fixture();
        const results = await Promise.allSettled(
          Array.from({ length: 21 }, (_, i) =>
            sendMessage(buyer.id, f.order.id, `message ${i}`),
          ),
        );
        assert.equal(
          results.filter((r) => r.status === "fulfilled").length,
          20,
        );
        assert.equal(
          await db.message.count({ where: { orderId: f.order.id } }),
          20,
        );
        assert.equal((await unreadCounts(f.seller.id)).get(f.order.id), 20);
        await readChat(f.seller.id, f.order.id);
        assert.equal(
          (await unreadCounts(f.seller.id)).get(f.order.id),
          undefined,
        );
        await sendMessage(f.seller.id, f.order.id, "reply");
        assert.equal((await unreadCounts(buyer.id)).get(f.order.id), 1);
      },
    );
    await t.test(
      "private images require participants, valid magic/type/size and matching message order",
      async () => {
        const f = await fixture();
        const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
        await sendMessage(
          buyer.id,
          f.order.id,
          "image",
          new File([png], "photo.png", { type: "image/png" }),
        );
        const message = await db.message.findFirstOrThrow({
          where: { orderId: f.order.id },
        });
        assert.deepEqual(
          new Uint8Array(
            (await readAttachment(f.seller.id, f.order.id, message.id)).body,
          ),
          png,
        );
        await assert.rejects(
          readAttachment(stranger.id, f.order.id, message.id),
        );
        const other = await fixture();
        await assert.rejects(
          readAttachment(buyer.id, other.order.id, message.id),
        );
        const chat = await readChat(buyer.id, f.order.id);
        assert.equal(chat.messages[0].hasAttachment, true);
        assert.ok(!JSON.stringify(chat).includes(message.attachmentKey!));
        await assert.rejects(
          sendMessage(
            buyer.id,
            f.order.id,
            "invalid",
            new File(["html"], "x.png", { type: "image/png" }),
          ),
        );
        await assert.rejects(
          sendMessage(
            buyer.id,
            f.order.id,
            "too big",
            new File([new Uint8Array(5 * 1024 * 1024 + 1)], "x.png", {
              type: "image/png",
            }),
          ),
        );
      },
    );
    await t.test(
      "reviews require delivery; unique create, one edit, reply, hide/unhide and refund keep both caches correct",
      async () => {
        const f = await fixture(false);
        await assert.rejects(
          writeReview(buyer.id, f.item.id, {
            positive: true,
            comment: "early",
          }),
        );
        await markOrderPaid(f.order.id, {
          provider: "test",
          reference: `${key}-review`,
          amount: 20000,
        });
        await assert.rejects(
          writeReview(stranger.id, f.item.id, {
            positive: true,
            comment: "forged",
          }),
        );
        async function counts(pos: number, neg: number) {
          for (const row of [
            await db.product.findUniqueOrThrow({ where: { id: f.product.id } }),
            await db.sellerProfile.findUniqueOrThrow({
              where: { id: f.sellerId },
            }),
          ]) {
            assert.equal(row.positiveReviews, pos);
            assert.equal(row.negativeReviews, neg);
          }
        }
        await writeReview(buyer.id, f.item.id, {
          positive: true,
          comment: "<script>plain text</script>",
        });
        await counts(1, 0);
        await assert.rejects(
          writeReview(buyer.id, f.item.id, {
            positive: true,
            comment: "duplicate",
          }),
        );
        await writeReview(
          buyer.id,
          f.item.id,
          { positive: false, comment: "edited" },
          "edit",
        );
        await counts(0, 1);
        await assert.rejects(
          writeReview(
            buyer.id,
            f.item.id,
            { positive: true, comment: "third" },
            "edit",
          ),
        );
        const review = await db.review.findUniqueOrThrow({
          where: { orderItemId: f.item.id },
        });
        await assert.rejects(replyReview(stranger.id, review.id, "forged"));
        await replyReview(f.seller.id, review.id, "seller reply");
        await assert.rejects(replyReview(f.seller.id, review.id, "twice"));
        await db.review.update({
          where: { id: review.id },
          data: { sellerReplyAt: null },
        });
        await assert.rejects(
          replyReview(
            f.seller.id,
            review.id,
            "legacy reply cannot be replaced",
          ),
        );
        assert.equal(
          (await db.review.findUniqueOrThrow({ where: { id: review.id } }))
            .sellerReply,
          "seller reply",
        );
        await moderateReview(admin.id, review.id, true, "abuse");
        await counts(0, 0);
        await moderateReview(admin.id, review.id, false, "restored");
        await counts(0, 1);
        await refundOrder(admin.id, f.order.id, "Externally refunded");
        await counts(0, 0);
        assert.equal(
          (await db.review.findUniqueOrThrow({ where: { id: review.id } }))
            .hiddenReason,
          "الطلب اترد",
        );
        await assert.rejects(
          moderateReview(admin.id, review.id, false, "cannot restore refund"),
        );
        await assert.rejects(
          writeReview(
            buyer.id,
            f.item.id,
            { positive: true, comment: "after refund" },
            "edit",
          ),
        );
      },
    );
    await t.test(
      "parallel disputes create exactly one; freeze constrains payouts and rejection unfreezes",
      async () => {
        const f = await fixture();
        await db.ledgerEntry.updateMany({
          where: { orderItemId: f.item.id, type: "SALE" },
          data: { availableAt: new Date(Date.now() - 1000) },
        });
        await db.ledgerEntry.create({
          data: { sellerId: f.sellerId, type: "ADJUSTMENT", amount: 20000 },
        });
        const results = await Promise.allSettled([
          openDispute(buyer.id, f.item.id, "المنتج مش شغال ومحتاج حل للمشكلة"),
          openDispute(buyer.id, f.item.id, "المنتج مش شغال ومحتاج حل للمشكلة"),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(
          await db.dispute.count({
            where: { orderItemId: f.item.id, status: "OPEN" },
          }),
          1,
        );
        const id = (
          results.find(
            (r) => r.status === "fulfilled",
          ) as PromiseFulfilledResult<string>
        ).value;
        assert.equal(await frozenAmount(f.sellerId, db), 18000);
        const available = (await sellerBalance(f.sellerId)).available;
        assert.equal(available, 38000);
        await assert.rejects(
          requestPayout(f.seller.id, available),
          /الرصيد المتاح/,
        );
        const payout = await requestPayout(f.seller.id, available - 18000);
        await processPayout(
          admin.id,
          payout,
          "REJECTED",
          "reset fixture payout",
        );
        await resolveDispute(admin.id, id, false, "Product is working");
        assert.equal(await frozenAmount(f.sellerId, db), 0);
        await requestPayout(f.seller.id, available);
      },
    );
    await t.test(
      "dispute refund is atomic and idempotent: one REFUND, resolved status and hidden review",
      async () => {
        const f = await fixture();
        await writeReview(buyer.id, f.item.id, {
          positive: true,
          comment: "review",
        });
        const id = await openDispute(
          buyer.id,
          f.item.id,
          "اشتريت المنتج وفيه مشكلة محتاجة استرداد",
        );
        await assert.rejects(resolveDispute(f.seller.id, id, true, "forged"));
        const results = await Promise.all([
          resolveDispute(admin.id, id, true, "Refunded externally"),
          resolveDispute(admin.id, id, true, "duplicate"),
        ]);
        assert.deepEqual(results.sort(), [false, true]);
        assert.equal(
          (await db.order.findUniqueOrThrow({ where: { id: f.order.id } }))
            .status,
          "REFUNDED",
        );
        assert.equal(
          (await db.dispute.findUniqueOrThrow({ where: { id } })).status,
          "RESOLVED_REFUND",
        );
        assert.equal(
          await db.ledgerEntry.count({
            where: { orderItemId: f.item.id, type: "REFUND" },
          }),
          1,
        );
        assert.ok(
          (
            await db.review.findUniqueOrThrow({
              where: { orderItemId: f.item.id },
            })
          ).hiddenAt,
        );
        assert.equal(
          (await db.product.findUniqueOrThrow({ where: { id: f.product.id } }))
            .positiveReviews,
          0,
        );
        const logs = await db.auditLog.findMany({
          where: { targetId: { in: [id, f.order.id] } },
        });
        assert.ok(!JSON.stringify(logs).includes("PRIVATE-CODE"));
        assert.ok(
          !(await db.message.findMany({ where: { orderId: f.order.id } })).some(
            (m) => m.body.includes("PRIVATE-CODE"),
          ),
        );
      },
    );
    await t.test(
      "three rejected disputes within 90 days block a fourth, older rejections do not",
      async () => {
        const repeat = await db.user.create({
          data: {
            email: `${key}-repeat@test.local`,
            name: "Repeat",
            passwordHash: "test",
          },
        });
        userIds.push(repeat.id);
        const ids: string[] = [];
        for (let i = 0; i < 3; i++) {
          const f = await fixture(true, repeat.id);
          const id = await openDispute(
            repeat.id,
            f.item.id,
            "شكوى بخصوص مشكلة محتاجة مراجعة الإدارة",
          );
          ids.push(id);
          await resolveDispute(admin.id, id, false, "Rejected");
        }
        const next = await fixture(true, repeat.id);
        await assert.rejects(
          openDispute(
            repeat.id,
            next.item.id,
            "شكوى رابعة بخصوص مشكلة في المنتج",
          ),
          /تواصل مع الدعم/,
        );
        await db.dispute.update({
          where: { id: ids[0] },
          data: { resolvedAt: new Date(Date.now() - 91 * 86400000) },
        });
        await openDispute(
          repeat.id,
          next.item.id,
          "شكوى رابعة بخصوص مشكلة في المنتج",
        );
      },
    );
  } finally {
    const messages = await db.message.findMany({
      where: { orderId: { in: orderIds } },
      select: { attachmentKey: true },
    });
    for (const m of messages)
      if (m.attachmentKey) await deletePrivateFile(m.attachmentKey);
    await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await db.orderRead.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.ledgerEntry.deleteMany({ where: { sellerId: { in: sellerIds } } });
    await db.payout.deleteMany({ where: { sellerId: { in: sellerIds } } });
    await db.order.deleteMany({ where: { id: { in: orderIds } } });
    await db.product.deleteMany({ where: { id: { in: productIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    await db.$disconnect();
  }
});
