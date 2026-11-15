import assert from "node:assert/strict";
import { test } from "node:test";
import {
  affiliateCommission,
  affiliateRateFor,
  normalizeRefCode,
  refCodeProblem,
} from "../src/lib/affiliate-rules";

test("ref codes are normalized and validated", () => {
  assert.equal(normalizeRefCode(" Ahmed_1 "), "ahmed_1");
  assert.equal(normalizeRefCode("ab"), null);
  assert.equal(normalizeRefCode("a".repeat(25)), null);
  assert.equal(normalizeRefCode("bad code"), null);
  assert.equal(normalizeRefCode("<script>"), null);
  assert.equal(normalizeRefCode(undefined), null);
  assert.equal(refCodeProblem("ahmed"), null);
  assert.ok(refCodeProblem("admin"));
  assert.ok(refCodeProblem("digiegy-official"));
  assert.ok(refCodeProblem("x"));
});

test("affiliate rate: store 0 turns it off, personal beats store beats default", () => {
  assert.equal(affiliateRateFor({ platformBps: 500, sellerBps: null, affiliateBps: null }), 500);
  assert.equal(affiliateRateFor({ platformBps: 500, sellerBps: 300, affiliateBps: null }), 300);
  assert.equal(affiliateRateFor({ platformBps: 500, sellerBps: 300, affiliateBps: 800 }), 800);
  assert.equal(affiliateRateFor({ platformBps: 500, sellerBps: 0, affiliateBps: 800 }), 0);
});

test("affiliate share is a floor of the total and never exceeds the platform commission", () => {
  assert.equal(affiliateCommission(10000, 1000, 500), 500);
  assert.equal(affiliateCommission(10000, 300, 500), 300);
  assert.equal(affiliateCommission(999, 100, 500), 49);
  assert.equal(affiliateCommission(10000, 0, 500), 0);
  assert.equal(affiliateCommission(10000, 1000, 0), 0);
});
