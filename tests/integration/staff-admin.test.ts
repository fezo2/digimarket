import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

test("staff admins and the saved ProdSeller key against PostgreSQL", async () => {
  assert.ok(
    process.env.TEST_DATABASE_URL,
    "Set TEST_DATABASE_URL to an isolated, migrated test database",
  );
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const { db } = await import("../../src/lib/db");
  const control = await import("../../src/lib/admin-control");
  const supplier = await import("../../src/lib/supplier");
  const prodseller = await import("../../src/lib/suppliers/prodseller");
  const key = randomUUID();
  const users: string[] = [];
  const before = await db.supplierSettings.findUnique({
    where: { id: "prodseller" },
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
    const existing = await db.user.create({
      data: { email: `${key}-old@test.local`, name: "قديم", passwordHash: "keep-me" },
    });
    users.push(existing.id);

    await assert.rejects(
      control.addStaffAdmin(owner.id, {
        name: "موظف",
        email: `${key}-staff@test.local`,
        password: "short",
        dataFrom: "",
      }),
      control.AdminControlError,
    );
    const staffId = await control.addStaffAdmin(owner.id, {
      name: "موظف",
      email: `${key}-staff@test.local`,
      password: "Strong-pass-2026!",
      dataFrom: "2026-11-01",
    });
    users.push(staffId);
    const staff = await db.user.findUniqueOrThrow({ where: { id: staffId } });
    assert.equal(staff.role, "ADMIN");
    assert.equal(staff.adminDataFrom?.toISOString(), "2026-10-31T22:00:00.000Z");
    assert.ok(staff.emailVerifiedAt);

    // A staff admin can't add admins, so can't widen their own view.
    await assert.rejects(
      control.addStaffAdmin(staffId, {
        name: "تاني",
        email: `${key}-x@test.local`,
        password: "Strong-pass-2026!",
        dataFrom: "",
      }),
      /غير مسموح/,
    );
    await assert.rejects(
      control.setStaffDataFrom(staffId, staffId, "2020-01-01"),
      /غير مسموح/,
    );

    // An existing account is promoted and keeps its password.
    await control.addStaffAdmin(owner.id, {
      name: "قديم",
      email: `${key}-old@test.local`,
      password: "",
      dataFrom: "",
    });
    const promoted = await db.user.findUniqueOrThrow({ where: { id: existing.id } });
    assert.equal(promoted.role, "ADMIN");
    assert.equal(promoted.passwordHash, "keep-me");
    assert.equal(promoted.sessionVersion, existing.sessionVersion + 1);

    await control.setStaffDataFrom(owner.id, staffId, "2026-12-01");
    await control.removeStaffAdmin(owner.id, staffId);
    const removed = await db.user.findUniqueOrThrow({ where: { id: staffId } });
    assert.equal(removed.role, "BUYER");
    assert.equal(removed.adminDataFrom, null);
    // The full admin can't be "removed" as staff.
    await assert.rejects(
      control.removeStaffAdmin(owner.id, owner.id),
      control.AdminControlError,
    );

    // The key saved from the panel wins over the environment.
    const envKey = process.env.PRODSELLER_API_KEY;
    process.env.PRODSELLER_API_KEY = "env-key-123456";
    await supplier.saveSupplierKey(owner.id, "  psk_saved_from_panel ");
    assert.equal(await prodseller.prodsellerKey(), "psk_saved_from_panel");
    await supplier.saveSupplierKey(owner.id, "");
    assert.equal(await prodseller.prodsellerKey(), "env-key-123456");
    await assert.rejects(supplier.saveSupplierKey(owner.id, "has space key"));
    process.env.PRODSELLER_API_KEY = envKey;
    const logs = await db.auditLog.findMany({ where: { actorId: owner.id } });
    assert.ok(logs.every((l) => !String(l.data ?? "").includes("psk_saved")));
  } finally {
    await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    if (before)
      await db.supplierSettings.update({
        where: { id: "prodseller" },
        data: { apiKey: before.apiKey },
      });
    else await db.supplierSettings.deleteMany({ where: { id: "prodseller" } });
    await db.$disconnect();
  }
});
