import type { Prisma } from "@prisma/client";

export function computeBalance(
  entries: readonly { amount: number; availableAt: Date }[],
  now: Date,
) {
  let available = 0,
    held = 0;
  for (const entry of entries) {
    if (entry.availableAt <= now) available += entry.amount;
    else held += entry.amount;
  }
  return { available, held, total: available + held };
}

export async function sellerBalance(
  sellerId: string,
  tx?: Prisma.TransactionClient,
  now = new Date(),
) {
  const client = tx ?? (await import("./db")).db;
  // A single snapshot. Payout decisions pass a transaction holding the seller lock.
  const entries = await client.ledgerEntry.findMany({
    where: { sellerId },
    select: { amount: true, availableAt: true },
  });
  return computeBalance(entries, now);
}

export const ledgerLabels = {
  SALE: "بيع",
  PAYOUT: "سحب",
  REFUND: "استرداد",
  ADJUSTMENT: "تسوية",
};
export const payoutLabels = {
  REQUESTED: "قيد المراجعة",
  PAID: "اتدفع",
  REJECTED: "مرفوض",
};
export const methodLabels = {
  INSTAPAY: "InstaPay",
  BANK_TRANSFER: "تحويل بنكي",
  MOBILE_WALLET: "محفظة موبايل",
};
