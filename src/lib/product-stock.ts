type StockStore = {
  findMany(args: {
    where: { productId: string; content: { in: string[] } };
    select: { content: true };
  }): Promise<{ content: string }[]>;
  createMany(args: {
    data: { productId: string; content: string }[];
  }): Promise<{ count: number }>;
};

// The caller must hold the seller lock in the same transaction.
export async function addStockCodes(
  stock: StockStore,
  productId: string,
  lines: string[],
) {
  const existing = await stock.findMany({
    where: {
      productId,
      // Never filter by status: a reserved or sold code cannot be reused.
      content: { in: [...new Set(lines)] },
    },
    select: { content: true },
  });
  const seen = new Set(existing.map((row) => row.content));
  const fresh = lines.filter((content) => {
    if (seen.has(content)) return false;
    seen.add(content);
    return true;
  });
  if (fresh.length)
    await stock.createMany({
      data: fresh.map((content) => ({ productId, content })),
    });
  return { added: fresh.length, duplicates: lines.length - fresh.length };
}
