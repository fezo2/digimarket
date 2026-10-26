import { z } from "zod";
import { toPiasters, parseEGP } from "./money";

export const destinationSchema = z
  .object({
    method: z.enum(["INSTAPAY", "BANK_TRANSFER", "MOBILE_WALLET"]),
    account: z.string().trim().max(100),
    holderName: z.string().trim().min(3, "اكتب اسم صاحب الحساب كامل").max(150),
  })
  .superRefine((v, ctx) => {
    const mobile = /^01[0125]\d{8}$/.test(v.account);
    const valid =
      v.method === "BANK_TRANSFER"
        ? /^EG\d{27}$/.test(v.account)
        : v.method === "MOBILE_WALLET"
          ? mobile
          : mobile || /^[A-Za-z0-9._-]+@instapay$/.test(v.account);
    if (!valid)
      ctx.addIssue({
        code: "custom",
        path: ["account"],
        message: "بيانات الحساب مش صحيحة لطريقة السحب المختارة",
      });
  });
export const passwordSchema = z
  .string()
  .min(1, "اكتب الباسورد الحالي")
  .max(200);
export const amountSchema = z
  .string()
  .regex(
    /^\d{1,7}(\.\d{1,2})?$/,
    "اكتب المبلغ بالجنيه بحد أقصى رقمين بعد العلامة",
  )
  .transform(parseEGP);
export const adjustmentSchema = z
  .string()
  .regex(/^-?\d{1,7}(\.\d{1,2})?$/, "اكتب مبلغ صحيح بالجنيه")
  .transform((s) =>
    s.startsWith("-") ? -toPiasters(s.slice(1)) : toPiasters(s),
  )
  .refine((n) => n !== 0, "المبلغ لازم يكون غير صفر");
export const noteSchema = z.string().trim().min(1, "اكتب السبب").max(1000);
export const idSchema = z.string().min(1).max(100);
export function payoutUnlockAt(changed: Date) {
  // Test override cannot shorten the production/development security window.
  const configured =
    process.env.NODE_ENV === "test"
      ? Number(process.env.TEST_PAYOUT_LOCK_MS)
      : NaN;
  const duration =
    Number.isFinite(configured) && configured >= 0 ? configured : 86400000;
  return new Date(changed.getTime() + duration);
}
