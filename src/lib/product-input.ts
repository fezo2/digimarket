import { z } from "zod";
import { toPiasters } from "./money";

const amount = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d{1,2})?$/, "اكتب مبلغ صحيح بحد أقصى رقمين بعد العلامة")
  .transform(toPiasters)
  .refine(Number.isSafeInteger)
  .refine((v) => Math.abs(v) <= 2_000_000_000);
const option = z
  .object({
    name: z.string().trim().min(1).max(100),
    kind: z.enum(["select", "text"]),
    required: z.boolean(),
    values: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(100),
          priceDelta: amount,
        }),
      )
      .max(50),
  })
  .refine(
    (v) => v.kind !== "select" || v.values.length > 0,
    "ضيف قيمة واحدة على الأقل للاختيار",
  );

export const productInput = z
  .object({
    title: z.string().trim().min(3).max(160),
    categoryId: z.string().min(1),
    description: z.string().trim().min(10).max(20000),
    // Ignored by the save action: a new photo comes as an uploaded file,
    // never as a URL from the browser.
    imageUrl: z.string().max(2000).default(""),
    price: amount.refine((v) => v >= 100, "السعر لازم يكون جنيه على الأقل"),
    compareAtPrice: z.union([z.literal("").transform(() => null), amount]),
    deliveryType: z.enum(["UNIQUE_CODES", "FILE", "TEXT", "LINK"]),
    deliveryContent: z.string().trim().max(50000),
    instructions: z.string().trim().max(10000),
    minQty: z.coerce.number().int().min(1).max(10000),
    maxQty: z.coerce.number().int().min(1).max(10000),
    intent: z.enum(["DRAFT", "PENDING_REVIEW"]),
    options: z.array(option).max(20),
    discounts: z
      .array(
        z.object({
          minQty: z.coerce.number().int().min(2).max(10000),
          percentOff: z.coerce.number().int().min(1).max(90),
        }),
      )
      .max(30),
  })
  .superRefine((v, ctx) => {
    const error = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (v.maxQty < v.minQty)
      error("أقصى كمية لازم تكون أكبر من أو تساوي أقل كمية");
    if (v.compareAtPrice !== null && v.compareAtPrice <= v.price)
      error("السعر قبل الخصم لازم يكون أكبر من السعر");
    if (new Set(v.discounts.map((d) => d.minQty)).size !== v.discounts.length)
      error("كمية الخصم متكررة");
    if (v.discounts.some((d) => d.minQty > v.maxQty))
      error("كمية الخصم أكبر من أقصى كمية");
    const minimumPrice =
      v.price +
      v.options.reduce(
        (sum, o) =>
          sum +
          (o.kind === "select"
            ? Math.min(
                ...o.values.map((x) => x.priceDelta),
                ...(o.required ? [] : [0]),
              )
            : 0),
        0,
      );
    if (minimumPrice < 100)
      error("السعر بعد أي مجموعة اختيارات لازم يكون جنيه على الأقل");
    if (["TEXT", "LINK"].includes(v.deliveryType) && !v.deliveryContent)
      error("محتوى التسليم مطلوب");
    if (
      v.deliveryType === "LINK" &&
      !/^https?:\/\/\S+$/.test(v.deliveryContent)
    )
      error("اكتب رابط تسليم صحيح");
  });

export const statusLabels = {
  DRAFT: "مسودة",
  PENDING_REVIEW: "قيد المراجعة",
  ACTIVE: "نشط",
  REJECTED: "مرفوض",
  PAUSED: "موقوف",
};
export const deliveryLabels = {
  UNIQUE_CODES: "كود أو حساب مختلف لكل مشتري من المخزون",
  FILE: "نفس الملف بيتسلّم لكل مشتري بعد الدفع",
  TEXT: "نص أو تعليمات بتظهر بعد الدفع",
  LINK: "رابط بيتكشف للمشتري بعد الدفع",
};
