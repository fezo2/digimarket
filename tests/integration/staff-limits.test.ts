import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

test("a staff admin can't serve themselves or reach another admin", async () => {
  assert.ok(
    process.env.TEST_DATABASE_URL,
    "Set TEST_DATABASE_URL to an isolated, migrated test database",
  );
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const { db } = await import("../../src/lib/db");
  const control = await import("../../src/lib/admin-control");
  const wallet = await import("../../src/lib/wallet");
  const { STAFF_DENIED } = await import("../../src/lib/staff-scope");
  const key = randomUUID();
  const users: string[] = [];
  const stores: string[] = [];
  const store = (slug: string) => ({
    create: {
      storeName: "متجر",
      slug,
      type: "COMPANY" as const,
      kycStatus: "APPROVED" as const,
    },
  });
  try {
    const owner = await db.user.create({
      data: {
        email: `${key}-owner@test.local`,
        name: "مالك",
        passwordHash: "test-only",
        role: "ADMIN",
      },
    });
    users.push(owner.id);
    // A staff admin who also runs a store.
    const staff = await db.user.create({
      data: {
        email: `${key}-staff@test.local`,
        name: "موظف",
        passwordHash: "test-only",
        role: "ADMIN",
        adminDataFrom: new Date(Date.now() - 86400000),
        seller: store(`${key}-staff`),
      },
      include: { seller: true },
    });
    users.push(staff.id);
    const other = await db.user.create({
      data: {
        email: `${key}-other@test.local`,
        name: "تاجر",
        passwordHash: "test-only",
        role: "SELLER",
        seller: store(`${key}-other`),
      },
      include: { seller: true },
    });
    users.push(other.id);
    stores.push(staff.seller!.id, other.seller!.id);
    const denied = new RegExp(STAFF_DENIED);

    // Not the owner's account, not their own.
    await assert.rejects(control.forceLogout(staff.id, owner.id), denied);
    await assert.rejects(
      control.updateUserProfile(staff.id, owner.id, {
        name: "اسم",
        phone: "",
        adminNote: "",
      }),
      denied,
    );
    await assert.rejects(control.forceLogout(staff.id, staff.id), denied);
    assert.equal(await control.forceLogout(staff.id, other.id), true);
    assert.equal(await control.forceLogout(owner.id, staff.id), true);

    // Not their own store's commission, payouts or sales.
    const ownStore = staff.seller!.id;
    await assert.rejects(
      control.setSellerTerms(staff.id, ownStore, { commission: "0", holdDays: "0" }),
      denied,
    );
    await assert.rejects(
      control.setPayoutsFrozen(staff.id, ownStore, false),
      denied,
    );
    assert.equal(
      await control.setSellerTerms(staff.id, other.seller!.id, {
        commission: "5",
        holdDays: "",
      }),
      true,
    );

    // Ledger adjustments stay with the owner.
    await assert.rejects(
      wallet.adjustLedger(staff.id, ownStore, 100000, "هدية", "whatever"),
      denied,
    );
    await assert.rejects(
      wallet.adjustLedger(staff.id, other.seller!.id, 100, "تسوية", "whatever"),
      denied,
    );

    // Re-typing the password is limited: a stolen cookie can't guess it.
    for (let i = 0; i < 10; i++)
      await assert.rejects(
        wallet.adjustLedger(owner.id, other.seller!.id, 100, "تسوية", "wrong-" + i),
        /الباسورد الحالي مش صحيح/,
      );
    await assert.rejects(
      wallet.adjustLedger(owner.id, other.seller!.id, 100, "تسوية", "wrong-x"),
      /محاولات كتير/,
    );

    // Can't mark their own store's payout as paid.
    const payout = await db.payout.create({
      data: {
        sellerId: ownStore,
        amount: 50000,
        method: "INSTAPAY",
        account: "me@instapay",
        holderName: "موظف",
      },
    });
    await assert.rejects(
      wallet.processPayout(staff.id, payout.id, "PAID", "ref-1"),
      denied,
    );
    assert.equal(
      await wallet.processPayout(owner.id, payout.id, "REJECTED", "تجربة"),
      true,
    );
  } finally {
    await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await db.notification.deleteMany({ where: { sellerId: { in: stores } } });
    await db.payout.deleteMany({ where: { seller: { userId: { in: users } } } });
    await db.ledgerEntry.deleteMany({ where: { seller: { userId: { in: users } } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
});
