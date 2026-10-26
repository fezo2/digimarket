import "server-only";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";

export class SellerToolError extends Error {}

export const MAX_REPLIES = 30;

export const replyInput = z.object({
  title: z.string().trim().min(2, "اكتب عنوان قصير").max(60, "العنوان طويل"),
  body: z.string().trim().min(2, "اكتب الرد").max(2000, "الرد طويل"),
});

export async function addReply(
  sellerId: string,
  input: z.input<typeof replyInput>,
) {
  const v = replyInput.parse(input);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SellerProfile" WHERE id = ${sellerId} FOR UPDATE`;
    if ((await tx.sellerReply.count({ where: { sellerId } })) >= MAX_REPLIES)
      throw new SellerToolError(`الحد ${MAX_REPLIES} رد جاهز`);
    return tx.sellerReply.create({ data: { ...v, sellerId } });
  });
}

export async function deleteReply(sellerId: string, id: string) {
  const r = await db.sellerReply.deleteMany({ where: { id, sellerId } });
  return r.count > 0;
}

const passwordInput = z.object({
  current: z.string().min(1, "اكتب الباسورد الحالي").max(200),
  next: z
    .string()
    .min(8, "الباسورد الجديد لازم 8 حروف على الأقل")
    .max(200),
});

// Returns the new session version so the caller can re-issue its cookie;
// every other device is signed out.
export async function changePassword(
  userId: string,
  input: z.input<typeof passwordInput>,
) {
  const v = passwordInput.parse(input);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await bcrypt.compare(v.current, user.passwordHash)))
    throw new SellerToolError("الباسورد الحالي غلط");
  if (v.current === v.next)
    throw new SellerToolError("اختار باسورد مختلف عن الحالي");
  const passwordHash = await bcrypt.hash(v.next, 12);
  const changed = await db.user.updateMany({
    where: { id: userId, passwordHash: user.passwordHash },
    data: { passwordHash, sessionVersion: { increment: 1 } },
  });
  if (!changed.count) throw new SellerToolError("حصل تغيير قبل كده، جرّب تاني");
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, role: true, sessionVersion: true },
  });
}

export type SalesFilter = { q?: string; from?: string; to?: string };

const day = (value: string | undefined, end = false) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(value + (end ? "T23:59:59.999Z" : "T00:00:00Z"));
  return Number.isNaN(d.getTime()) ? undefined : d;
};

// One filter for the sales table and its CSV export. The search box takes
// an order number, buyer email, product title or a delivered code.
export function salesWhere(
  sellerId: string,
  f: SalesFilter,
): Prisma.OrderItemWhereInput {
  const q = (f.q ?? "").trim().replace(/^#/, "").slice(0, 200);
  const from = day(f.from);
  const to = day(f.to, true);
  return {
    sellerId,
    order: {
      status: { in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] },
      ...(from || to ? { paidAt: { gte: from, lte: to } } : {}),
    },
    ...(q
      ? {
          OR: [
            ...(/^\d{1,9}$/.test(q) ? [{ order: { number: Number(q) } }] : []),
            { order: { buyer: { email: { contains: q, mode: "insensitive" } } } },
            { title: { contains: q, mode: "insensitive" } },
            { stockItems: { some: { content: q } } },
          ],
        }
      : {}),
  };
}

const cell = (v: string | number) => {
  if (typeof v === "number") return String(v);
  // Quote text and defuse spreadsheet formulas.
  return '"' + (/^[=+\-@\t\r]/.test(v) ? "'" : "") + v.replace(/"/g, '""') + '"';
};

export function toCsv(rows: (string | number)[][]) {
  // BOM so Excel opens Arabic text as UTF-8.
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export function toolError(error: unknown) {
  if (error instanceof SellerToolError) return { error: error.message };
  if (error instanceof z.ZodError)
    return { error: error.issues[0]?.message ?? "راجع البيانات" };
  throw error;
}
