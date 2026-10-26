import test from "node:test";
import assert from "node:assert/strict";
import { quote } from "../src/lib/pricing";

const basic = {
  basePrice: 10000,
  optionDeltas: [],
  quantity: 2,
  quantityDiscounts: [],
  commissionBps: 1000,
};
test("quote without discounts", () => {
  assert.deepEqual(quote(basic), {
    unitPrice: 10000,
    subtotal: 20000,
    quantityDiscount: 0,
    couponDiscount: 0,
    total: 20000,
    commission: 2000,
    sellerNet: 18000,
  });
});
test("quantity discount selects highest eligible percentage, not highest threshold", () => {
  const result = quote({
    ...basic,
    quantity: 5,
    quantityDiscounts: [
      { minQty: 2, percentOff: 20 },
      { minQty: 5, percentOff: 10 },
      { minQty: 6, percentOff: 50 },
    ],
  });
  assert.equal(result.quantityDiscount, 10000);
  assert.equal(result.total, 40000);
});
test("percentage coupon follows the quantity discount and uses Math.round", () => {
  const result = quote({
    ...basic,
    basePrice: 10101,
    quantity: 1,
    quantityDiscounts: [{ minQty: 1, percentOff: 10 }],
    coupon: { percentOff: 15, amountOff: null, minTotal: 0 },
  });
  assert.equal(result.quantityDiscount, 1010);
  assert.equal(result.couponDiscount, 1364);
  assert.equal(result.total, 7727);
});
test("oversized amount coupon cannot reduce the total below one EGP", () => {
  const result = quote({
    ...basic,
    coupon: { percentOff: null, amountOff: 999999, minTotal: 0 },
  });
  assert.equal(result.couponDiscount, 19900);
  assert.equal(result.total, 100);
});
test("coupon threshold is checked after quantity discount", () => {
  const result = quote({
    ...basic,
    quantityDiscounts: [{ minQty: 2, percentOff: 10 }],
    coupon: { percentOff: 20, amountOff: null, minTotal: 19000 },
  });
  assert.equal(result.couponDiscount, 0);
  assert.equal(result.total, 18000);
});
test("negative option deltas are allowed but final unit price cannot be below 100", () => {
  assert.equal(quote({ ...basic, optionDeltas: [-2500, 500] }).unitPrice, 8000);
  assert.throws(() => quote({ ...basic, optionDeltas: [-9901] }));
});
test("commission uses the final discounted total and reconciles to seller net", () => {
  const result = quote({
    ...basic,
    optionDeltas: [2000],
    quantityDiscounts: [{ minQty: 2, percentOff: 5 }],
    coupon: { percentOff: 10, amountOff: null, minTotal: 0 },
    commissionBps: 1500,
  });
  assert.equal(result.total, 20520);
  assert.equal(result.commission, 3078);
  assert.equal(result.sellerNet, 17442);
});
test("zero/fractional quantity, invalid money and integer overflow are rejected", () => {
  for (const quantity of [0, 1.5, NaN])
    assert.throws(() => quote({ ...basic, quantity }));
  assert.throws(() => quote({ ...basic, basePrice: 2147483647 }));
  assert.throws(() => quote({ ...basic, optionDeltas: [0.1] }));
});
