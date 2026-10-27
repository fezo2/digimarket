import assert from "node:assert/strict";
import test from "node:test";
import { productInput } from "../src/lib/product-input";

const valid = {
  title: "منتج اختبار",
  categoryId: "category",
  description: "وصف كامل للمنتج التجريبي",
  imageUrl: "",
  price: "100.25",
  compareAtPrice: "",
  deliveryType: "UNIQUE_CODES",
  deliveryContent: "",
  instructions: "",
  minQty: "1",
  maxQty: "10",
  intent: "PENDING_REVIEW",
  options: [],
  discounts: [],
};

test("prices become integer piasters without silently truncating invalid input", () => {
  assert.equal(productInput.parse(valid).price, 10025);
  assert.equal(
    productInput.parse({ ...valid, compareAtPrice: "120.50" }).compareAtPrice,
    12050,
  );
  for (const price of [
    "1.234",
    "100garbage",
    "0.99",
    "Infinity",
    "1e4",
    "99999999999999",
  ])
    assert.equal(
      productInput.safeParse({ ...valid, price }).success,
      false,
      price,
    );
});

test("compare-at price must exceed the sale price", () => {
  assert.equal(
    productInput.safeParse({ ...valid, compareAtPrice: "99" }).success,
    false,
  );
  assert.equal(
    productInput.safeParse({ ...valid, compareAtPrice: "100.25" }).success,
    false,
  );
});

test("combined negative option deltas cannot lower the price below one EGP", () => {
  const option = (priceDelta: string) => ({
    name: "اختيار",
    kind: "select",
    required: true,
    values: [{ label: "قيمة", priceDelta }],
  });
  assert.equal(
    productInput.safeParse({
      ...valid,
      options: [option("-60"), option("-40")],
    }).success,
    false,
  );
  const parsed = productInput.parse({
    ...valid,
    options: [option("-60"), option("-39")],
  });
  assert.equal(parsed.options[0].values[0].priceDelta, -6000);
});

test("optional choices include the zero-delta path in minimum price validation", () => {
  const options = [
    {
      name: "زيادة",
      kind: "select",
      required: false,
      values: [{ label: "زيادة", priceDelta: "20" }],
    },
    {
      name: "خصم",
      kind: "select",
      required: true,
      values: [{ label: "خصم", priceDelta: "-100" }],
    },
  ];
  assert.equal(productInput.safeParse({ ...valid, options }).success, false);
});

test("select options need values and quantity discounts have unique thresholds", () => {
  assert.equal(
    productInput.safeParse({
      ...valid,
      options: [{ name: "فارغ", kind: "select", required: true, values: [] }],
    }).success,
    false,
  );
  assert.equal(
    productInput.safeParse({
      ...valid,
      discounts: [
        { minQty: 2, percentOff: 5 },
        { minQty: 2, percentOff: 10 },
      ],
    }).success,
    false,
  );
  assert.equal(
    productInput.safeParse({
      ...valid,
      discounts: [{ minQty: 11, percentOff: 5 }],
    }).success,
    false,
  );
  assert.equal(
    productInput.safeParse({
      ...valid,
      discounts: [{ minQty: 2, percentOff: 91 }],
    }).success,
    false,
  );
  assert.equal(
    productInput.safeParse({ ...valid, minQty: 5, maxQty: 2 }).success,
    false,
  );
});

test("delivery and image links accept only HTTP(S) and text delivery needs content", () => {
  assert.equal(
    productInput.safeParse({ ...valid, deliveryType: "TEXT" }).success,
    false,
  );
  assert.equal(
    productInput.safeParse({
      ...valid,
      deliveryType: "LINK",
      deliveryContent: "javascript:alert(1)",
    }).success,
    false,
  );
  assert.equal(
    productInput.safeParse({
      ...valid,
      deliveryType: "LINK",
      deliveryContent: "https://example.com/redeem",
    }).success,
    true,
  );
});
