import assert from "node:assert/strict";
import test from "node:test";
import {
  passwordHashFor,
  siteSessionVersion,
  sitePasswordUpdate,
} from "../src/lib/site-password";

const base = {
  passwordHash: "store",
  sellerPasswordHash: null as string | null,
  adminPasswordHash: null as string | null,
  role: "BUYER",
  hasStore: false,
};

test("seller and admin fall back to the store password until set", () => {
  assert.equal(passwordHashFor(base, "seller"), "store");
  assert.equal(passwordHashFor(base, "admin"), "store");
  const own = { ...base, sellerPasswordHash: "s", adminPasswordHash: "a" };
  assert.equal(passwordHashFor(own, "store"), "store");
  assert.equal(passwordHashFor(own, "seller"), "s");
  assert.equal(passwordHashFor(own, "admin"), "a");
});

test("a store change keeps a seller's and admin's current password", () => {
  const data = sitePasswordUpdate(
    { ...base, role: "ADMIN", hasStore: true },
    "store",
    "new",
  );
  assert.deepEqual(data, {
    passwordHash: "new",
    storeSessionVersion: { increment: 1 },
    sellerPasswordHash: "store",
    adminPasswordHash: "store",
  });
  // A plain buyer has nothing to keep: a store opened later uses the new one.
  assert.deepEqual(sitePasswordUpdate(base, "store", "new"), {
    passwordHash: "new",
    storeSessionVersion: { increment: 1 },
  });
});

test("seller and admin changes touch only their own portal", () => {
  assert.deepEqual(sitePasswordUpdate(base, "seller", "x"), {
    sellerPasswordHash: "x",
    sellerSessionVersion: { increment: 1 },
  });
  assert.deepEqual(sitePasswordUpdate(base, "admin", "x"), {
    adminPasswordHash: "x",
    adminSessionVersion: { increment: 1 },
  });
  const v = {
    sessionVersion: 0,
    storeSessionVersion: 1,
    sellerSessionVersion: 2,
    adminSessionVersion: 3,
  };
  assert.equal(siteSessionVersion(v, "store"), 1);
  assert.equal(siteSessionVersion(v, "seller"), 2);
  assert.equal(siteSessionVersion(v, "admin"), 3);
});
