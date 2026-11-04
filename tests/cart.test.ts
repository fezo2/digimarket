import assert from "node:assert/strict";
import { test } from "node:test";
import { addLine, CART_MAX_LINES, parseCart, type CartLine } from "../src/lib/cart-lines";

const line = (id: string, q = 1, s: Record<string, string> = {}): CartLine => ({ id, p: "prod", q, s, t: {} });

test("same product and choices merge, capped at max quantity", () => {
  const one = addLine([], line("a", 2), 5)!;
  const two = addLine(one, line("b", 4), 5)!;
  assert.equal(two.length, 1);
  assert.equal(two[0].q, 5);
});

test("different choices make separate lines", () => {
  const one = addLine([], line("a", 1, { o: "x" }), 5)!;
  assert.equal(addLine(one, line("b", 1, { o: "y" }), 5)!.length, 2);
});

test("a full cart refuses new lines", () => {
  let lines: CartLine[] = [];
  for (let i = 0; i < CART_MAX_LINES; i++) lines = addLine(lines, { ...line(`l${i}`), p: `p${i}` }, 5)!;
  assert.equal(addLine(lines, { ...line("x"), p: "new" }, 5), null);
});

test("a broken cookie reads as an empty cart", () => {
  assert.deepEqual(parseCart("not json"), []);
  assert.deepEqual(parseCart('[{"id":1}]'), []);
  assert.equal(parseCart(JSON.stringify([line("a")])).length, 1);
});
