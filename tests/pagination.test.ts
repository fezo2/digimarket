import { test } from "node:test";
import assert from "node:assert/strict";
import { pageHref, pageParam, pageWindow, paginate } from "../src/lib/pagination";

test("pageParam reads positive whole numbers only", () => {
  assert.equal(pageParam(undefined), 1);
  assert.equal(pageParam("3"), 3);
  assert.equal(pageParam(["4", "5"]), 4);
  for (const bad of ["0", "-2", "1.5", "abc", ""]) assert.equal(pageParam(bad), 1);
});

test("paginate clamps to the last page and computes offsets", () => {
  assert.deepEqual(paginate(45, 20, "2"), { page: 2, pages: 3, perPage: 20, total: 45, skip: 20, take: 20 });
  assert.equal(paginate(45, 20, "99").page, 3);
  assert.equal(paginate(0, 20, "5").page, 1);
  assert.equal(paginate(0, 20, "5").pages, 1);
});

test("pageWindow keeps the ends and the pages next to the current one", () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(2, 4), [1, 2, 3, 4]);
  assert.deepEqual(pageWindow(6, 20), [1, null, 5, 6, 7, null, 20]);
  assert.deepEqual(pageWindow(3, 20), [1, 2, 3, 4, null, 20]);
  assert.deepEqual(pageWindow(20, 20), [1, null, 19, 20]);
});

test("pageHref keeps filters and leaves page 1 off", () => {
  assert.equal(pageHref({ q: "gpt", page: "3", empty: undefined }, 1), "?q=gpt");
  assert.equal(pageHref({ q: "gpt" }, 2), "?q=gpt&page=2");
  assert.equal(pageHref({}, 1), "?");
  assert.equal(pageHref({}, 1, { path: "/search" }), "/search");
  assert.equal(pageHref({ sort: "newest" }, 3, { path: "/categories/ai" }), "/categories/ai?sort=newest&page=3");
});
