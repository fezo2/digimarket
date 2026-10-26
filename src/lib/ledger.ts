import { db } from "./db";

export async function sellerBalance(sellerId: string) {
  const now = new Date();
  const [total, available] = await Promise.all([
    db.ledgerEntry.aggregate({ where: { sellerId }, _sum: { amount: true } }),
    db.ledgerEntry.aggregate({ where: { sellerId, availableAt: { lte: now } }, _sum: { amount: true } }),
  ]);
  const totalAmount = total._sum.amount ?? 0;
  const availableAmount = available._sum.amount ?? 0;
  return { total: totalAmount, available: availableAmount, held: totalAmount - availableAmount };
}
