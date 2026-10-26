import { z } from "zod";

export const orderSnapshot = z.object({
  choices: z.array(z.object({ name: z.string(), value: z.string() })),
  pricing: z.object({
    basePrice: z.number().int(),
    optionDeltas: z.array(z.number().int()),
    quantityDiscounts: z.array(
      z.object({ minQty: z.number().int(), percentOff: z.number().int() }),
    ),
  }),
});
export function readOrderSnapshot(value: string | null) {
  return orderSnapshot.parse(JSON.parse(value ?? "{}"));
}
export const orderStatusLabels = {
  PENDING_PAYMENT: "مستني الدفع",
  PAID: "مدفوع",
  CANCELLED: "ملغي",
  REFUNDED: "مسترد",
  PARTIALLY_REFUNDED: "مسترد جزئيًا",
};
