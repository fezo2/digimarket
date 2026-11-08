import assert from "node:assert/strict";
import test from "node:test";
import { staffMayNotTouch } from "../src/lib/staff-scope";

test("staff scope: full admins are never limited", () => {
  const owner = { id: "o", adminDataFrom: null };
  assert.equal(
    staffMayNotTouch(owner, { createdAt: new Date(0), userIds: ["o"], admin: true }),
    false,
  );
});

test("staff scope: dates, own records and other admins", () => {
  const from = new Date("2026-11-01T00:00:00Z");
  const staff = { id: "s", adminDataFrom: from };
  assert.equal(staffMayNotTouch(staff, { createdAt: new Date("2026-10-31T23:59:59Z") }), true);
  assert.equal(staffMayNotTouch(staff, { createdAt: from }), false);
  assert.equal(staffMayNotTouch(staff, { userIds: ["x", "s"] }), true);
  assert.equal(staffMayNotTouch(staff, { userIds: ["x", null, undefined] }), false);
  assert.equal(staffMayNotTouch(staff, { admin: true }), true);
  assert.equal(staffMayNotTouch(staff, {}), false);
});
