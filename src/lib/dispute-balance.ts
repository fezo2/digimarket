import "server-only";
import type { Prisma } from "@prisma/client";
export async function frozenAmount(
  sellerId: string,
  tx: Prisma.TransactionClient,
  now = new Date(),
) {
  const result = await tx.orderItem.aggregate({
    where: {
      sellerId,
      disputes: { some: { status: "OPEN" } },
      ledger: {
        some: { type: "SALE", availableAt: { lte: now } },
        none: { type: "REFUND" },
      },
    },
    _sum: { sellerNet: true },
  });
  return result._sum.sellerNet ?? 0;
}
