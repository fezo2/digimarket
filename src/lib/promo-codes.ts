import "server-only";
import { z } from "zod";
import { db } from "./db";
import { parseEGP } from "./money";
import { cairoMidnight } from "./seller-period";
import { SellerToolError } from "./seller-tools";

export const MAX_PROMO_CODES = 50;

const egp = (message: string) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d{1,7}(\.\d{1,2})?$/.test(v), message)
    .transform(parseEGP);

// What a seller types in the "new promo code" form. Amounts are in pounds
// and come back in piasters; the expiry day ends at Cairo midnight.
export const promoInput = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,24}$/, "الكود من ٣ لـ ٢٤ حرف إنجليزي أو رقم من غير مسافات"),
    kind: z.enum(["percent", "amount"]),
    value: z.string().trim(),
    minTotal: z.union([z.literal(""), egp("الحد الأدنى للطلب مش صحيح")]).transform((v) => v || 0),
    usageLimit: z
      .union([z.literal(""), z.coerce.number().int("عدد مرات الاستخدام لازم رقم صحيح").min(1).max(100000)])
      .transform((v) => (v === "" ? null : v)),
    expires: z
      .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ الانتهاء مش صحيح")])
      .transform((v) => {
        if (!v) return null;
        const [y, m, d] = v.split("-").map(Number);
        return cairoMidnight(y, m, d + 1);
      }),
  })
  .transform((v, ctx) => {
    let percentOff: number | null = null;
    let amountOff: number | null = null;
    if (v.kind === "percent") {
      percentOff = Number(v.value);
      if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 90) {
        ctx.addIssue({ code: "custom", message: "نسبة الخصم من ١ لـ ٩٠٪" });
        return z.NEVER;
      }
    } else {
      if (!/^\d{1,7}(\.\d{1,2})?$/.test(v.value) || parseEGP(v.value) < 100) {
        ctx.addIssue({ code: "custom", message: "قيمة الخصم لازم جنيه واحد على الأقل" });
        return z.NEVER;
      }
      amountOff = parseEGP(v.value);
    }
    if (v.expires && v.expires <= new Date()) {
      ctx.addIssue({ code: "custom", message: "تاريخ الانتهاء لازم يكون في المستقبل" });
      return z.NEVER;
    }
    return {
      code: v.code,
      percentOff,
      amountOff,
      minTotal: v.minTotal,
      usageLimit: v.usageLimit,
      expiresAt: v.expires,
    };
  });

export async function createPromo(sellerId: string, input: z.input<typeof promoInput>) {
  const v = promoInput.parse(input);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SellerProfile" WHERE id = ${sellerId} FOR UPDATE`;
    if ((await tx.coupon.count({ where: { sellerId } })) >= MAX_PROMO_CODES)
      throw new SellerToolError("وصلت للحد الأقصى لأكواد الخصم");
    // Codes are shared by the whole marketplace, in any letter case.
    if (await tx.coupon.count({ where: { code: { equals: v.code, mode: "insensitive" } } }))
      throw new SellerToolError("الكود ده مستخدم، اختار كود تاني");
    return tx.coupon.create({ data: { ...v, sellerId } });
  });
}

export async function setPromoActive(sellerId: string, id: string, active: boolean) {
  const r = await db.coupon.updateMany({ where: { id, sellerId }, data: { active } });
  return r.count > 0;
}

// A code that any order used (even unpaid) stays for the record; it can
// only be switched off.
export async function deletePromo(sellerId: string, id: string) {
  return db.$transaction(async (tx) => {
    const coupon = await tx.coupon.findFirst({
      where: { id, sellerId },
      select: { usedCount: true, _count: { select: { orders: true } } },
    });
    if (!coupon) return false;
    if (coupon.usedCount || coupon._count.orders)
      throw new SellerToolError("الكود اتستخدم في طلبات، تقدر توقفه بس");
    await tx.coupon.delete({ where: { id } });
    return true;
  });
}
