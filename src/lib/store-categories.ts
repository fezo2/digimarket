import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { SellerToolError } from "./seller-tools";

// A seller's own categories for their store page (separate from the
// site-wide Category, which decides commission and the main catalog).
export const MAX_STORE_CATEGORIES = 50;

const nameInput = z
  .string()
  .trim()
  .min(2, "اسم التصنيف قصير")
  .max(40, "اسم التصنيف طويل (٤٠ حرف بالكتير)");

function duplicate(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    throw new SellerToolError("عندك تصنيف بنفس الاسم");
  throw error;
}

export function listStoreCategories(sellerId: string) {
  return db.storeCategory.findMany({
    where: { sellerId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true },
  });
}

export async function createStoreCategory(sellerId: string, name: string) {
  const v = nameInput.parse(name);
  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SellerProfile" WHERE id = ${sellerId} FOR UPDATE`;
      const count = await tx.storeCategory.count({ where: { sellerId } });
      if (count >= MAX_STORE_CATEGORIES)
        throw new SellerToolError(`الحد ${MAX_STORE_CATEGORIES} تصنيف`);
      const last = await tx.storeCategory.aggregate({ where: { sellerId }, _max: { sortOrder: true } });
      return tx.storeCategory.create({
        data: { sellerId, name: v, sortOrder: (last._max.sortOrder ?? 0) + 1 },
      });
    });
  } catch (error) {
    duplicate(error);
  }
}

export async function renameStoreCategory(sellerId: string, id: string, name: string) {
  const v = nameInput.parse(name);
  try {
    const r = await db.storeCategory.updateMany({ where: { id, sellerId }, data: { name: v } });
    return r.count > 0;
  } catch (error) {
    duplicate(error);
  }
}

// Products in a deleted category stay on sale, just without a store category.
export async function deleteStoreCategory(sellerId: string, id: string) {
  const r = await db.storeCategory.deleteMany({ where: { id, sellerId } });
  return r.count > 0;
}

// Swap with the neighbour above or below; renumbers the list so old equal
// sortOrder values can't block the move.
export async function moveStoreCategory(sellerId: string, id: string, dir: "up" | "down") {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SellerProfile" WHERE id = ${sellerId} FOR UPDATE`;
    const list = await tx.storeCategory.findMany({
      where: { sellerId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const i = list.findIndex((c) => c.id === id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return false;
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(
      list.map((c, n) => tx.storeCategory.update({ where: { id: c.id }, data: { sortOrder: n + 1 } })),
    );
    return true;
  });
}

// Put several of the seller's products in one store category (or none).
export async function assignStoreCategory(sellerId: string, productIds: string[], storeCategoryId: string | null) {
  if (storeCategoryId && !(await db.storeCategory.findFirst({ where: { id: storeCategoryId, sellerId } })))
    throw new SellerToolError("التصنيف غير موجود");
  const r = await db.product.updateMany({
    where: { sellerId, id: { in: productIds.slice(0, 200) } },
    data: { storeCategoryId },
  });
  return r.count;
}
