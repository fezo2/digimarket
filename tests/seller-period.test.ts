import assert from "node:assert/strict";
import test from "node:test";
import { cairoDay, cairoMidnight, parsePeriod, percentChange, periodSlots, withParams } from "../src/lib/seller-period";

// 2026-12-15 20:30 UTC = 22:30 in Cairo (winter time, UTC+2).
const now = new Date("2026-12-15T20:30:00Z");

test("Cairo midnight follows the local offset, summer and winter", () => {
  assert.equal(cairoMidnight(2026, 12, 15).toISOString(), "2026-12-14T22:00:00.000Z");
  assert.equal(cairoMidnight(2026, 7, 1).toISOString(), "2026-06-30T21:00:00.000Z");
  assert.equal(cairoDay(new Date("2026-12-15T22:30:00Z")), "2026-12-16");
});

test("period tabs map to Cairo day ranges", () => {
  const today = parsePeriod({ p: "today" }, "30d", now);
  assert.equal(today.from?.toISOString(), "2026-12-14T22:00:00.000Z");
  assert.equal(today.to, now);
  const yesterday = parsePeriod({ p: "yesterday" }, "30d", now);
  assert.equal(yesterday.from?.toISOString(), "2026-12-13T22:00:00.000Z");
  assert.equal(yesterday.to.toISOString(), "2026-12-14T22:00:00.000Z");
  assert.equal(yesterday.prevTo?.toISOString(), "2026-12-13T22:00:00.000Z");
  const month = parsePeriod({}, "30d", now);
  assert.equal(month.key, "30d");
  assert.equal(periodSlots(month).length, 30);
  assert.equal(periodSlots(month).at(-1)?.key, "2026-12-15");
  const half = parsePeriod({ p: "6m" }, "30d", now);
  assert.equal(half.bucket, "month");
  assert.deepEqual(periodSlots(half).map((s) => s.key), ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]);
});

test("custom ranges are inclusive and bad input falls back", () => {
  const r = parsePeriod({ p: "range", from: "2026-10-01", to: "2026-10-03" }, "all", now);
  assert.equal(r.fromDay, "2026-10-01");
  assert.equal(r.toDay, "2026-10-03");
  assert.equal(periodSlots(r).length, 3);
  assert.equal(parsePeriod({ p: "nope" }, "all", now).from, null);
  const flipped = parsePeriod({ p: "range", from: "2026-10-05", to: "2026-10-01" }, "all", now);
  assert.ok(flipped.to > flipped.from!);
});

test("helpers", () => {
  assert.equal(percentChange(348, 1276), -72.7);
  assert.equal(percentChange(5, 0), null);
  assert.equal(withParams({ a: "1", b: undefined }, { page: "2" }), "?a=1&page=2");
});
