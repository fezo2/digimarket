import { z } from "zod";
export const communityId = z.string().min(1).max(100);
export const messageBody = z
  .string()
  .trim()
  .min(1, "اكتب رسالة")
  .max(2000, "الرسالة طويلة");
export const reviewInput = z.object({
  positive: z.boolean(),
  comment: z.string().trim().max(1000),
});
export const disputeReason = z
  .string()
  .trim()
  .min(20, "اكتب سبب الشكوى في ٢٠ حرف على الأقل")
  .max(2000);
export function maskContact(body: string) {
  const text = body
    .split(/([A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g)
    .map((part, index) =>
      index % 2
        ? part
        : part
            .replace(
              /(?<![\d@])(?:\+?20[ -]?(?:0[ -]?)?|0[ -]?)1[ -]?[0125](?:[ -]?\d){8}(?!\d)/g,
              "[محذوف]",
            )
            .replace(
              /(?:https?:\/\/)?(?:www\.)?(?:wa\.me|t\.me|(?:api\.|web\.)?whatsapp(?:\.com)?|telegram(?:\.me|\.org)?)(?:[/?][^\s<>]*)?/gi,
              "[محذوف]",
            ),
    )
    .join("");
  return { body: text, flagged: text !== body };
}
export function canReview(
  status: string,
  deliveredAt: Date | null,
  now = new Date(),
) {
  return (
    status === "PAID" &&
    deliveredAt !== null &&
    now >= deliveredAt &&
    now.getTime() <= deliveredAt.getTime() + 30 * 86400000
  );
}
export function canEditReview(
  createdAt: Date,
  editedOnce: boolean,
  now = new Date(),
) {
  return (
    !editedOnce &&
    now >= createdAt &&
    now.getTime() <= createdAt.getTime() + 7 * 86400000
  );
}
export function reviewPercent(positive: number, negative: number) {
  const count = positive + negative;
  return count
    ? `${Math.round((positive * 100) / count)}% تقييمات إيجابية (${count})`
    : "لسه مفيش تقييمات";
}
