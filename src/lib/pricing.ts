import { commissionFor } from "./money";

export class PricingError extends Error {}

export type QuoteInput = {
  basePrice: number;
  optionDeltas: number[];
  quantity: number;
  quantityDiscounts: { minQty: number; percentOff: number }[];
  coupon?: {
    percentOff: number | null;
    amountOff: number | null;
    minTotal: number;
  } | null;
  commissionBps: number;
};

export function quote(input: QuoteInput) {
  const {
    basePrice,
    optionDeltas,
    quantity,
    quantityDiscounts,
    coupon,
    commissionBps,
  } = input;
  const integers = [basePrice, ...optionDeltas, quantity, commissionBps];
  if (
    !integers.every(Number.isSafeInteger) ||
    quantity < 1 ||
    commissionBps < 0 ||
    commissionBps > 10000
  )
    throw new PricingError("بيانات التسعير مش صحيحة");
  const unitPrice =
    basePrice + optionDeltas.reduce((sum, delta) => sum + delta, 0);
  if (unitPrice < 100) throw new PricingError("السعر لازم يكون جنيه على الأقل");
  const subtotal = unitPrice * quantity;
  if (!Number.isSafeInteger(subtotal) || subtotal > 2147483647)
    throw new PricingError("قيمة الطلب أكبر من المسموح");
  for (const d of quantityDiscounts) {
    if (
      !Number.isInteger(d.minQty) ||
      d.minQty < 1 ||
      !Number.isInteger(d.percentOff) ||
      d.percentOff < 0 ||
      d.percentOff > 100
    )
      throw new PricingError("خصم الكمية مش صحيح");
  }
  const percent = Math.max(
    0,
    ...quantityDiscounts
      .filter((d) => d.minQty <= quantity)
      .map((d) => d.percentOff),
  );
  const quantityDiscount = Math.round((subtotal * percent) / 100);
  const afterQuantity = subtotal - quantityDiscount;
  let couponDiscount = 0;
  if (coupon) {
    if (
      !Number.isSafeInteger(coupon.minTotal) ||
      coupon.minTotal < 0 ||
      (coupon.percentOff !== null &&
        (!Number.isInteger(coupon.percentOff) ||
          coupon.percentOff < 0 ||
          coupon.percentOff > 100)) ||
      (coupon.amountOff !== null &&
        (!Number.isSafeInteger(coupon.amountOff) || coupon.amountOff < 0))
    )
      throw new PricingError("بيانات الكوبون مش صحيحة");
    if (afterQuantity >= coupon.minTotal)
      couponDiscount =
        coupon.percentOff !== null
          ? Math.round((afterQuantity * coupon.percentOff) / 100)
          : Math.min(coupon.amountOff ?? 0, afterQuantity);
  }
  couponDiscount = Math.min(couponDiscount, Math.max(0, afterQuantity - 100));
  const total = Math.max(100, afterQuantity - couponDiscount);
  const commission = commissionFor(total, commissionBps);
  return {
    unitPrice,
    subtotal,
    quantityDiscount,
    couponDiscount,
    total,
    commission,
    sellerNet: total - commission,
  };
}
