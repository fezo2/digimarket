"use server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { participant } from "@/lib/chat";
import { r2 } from "@/lib/r2";
import { z } from "zod";
export async function createUploadUrl(
  kind: unknown,
  size: unknown,
  type: unknown,
  context: unknown,
) {
  const user = await requireUser();
  const v = z
    .object({
      kind: z.enum(["product", "kyc", "chat"]),
      size: z.number().int().positive(),
      type: z.string().max(100),
      context: z.string().max(100),
    })
    .parse({ kind, size, type, context });
  if (process.env.STORAGE_DRIVER !== "r2") return { local: true } as const;
  if (v.kind === "chat") await participant(db, user.id, v.context);
  else {
    if (
      !user.seller ||
      (v.kind === "product" && user.seller.kycStatus !== "APPROVED")
    )
      throw new Error("غير مسموح");
    if (
      v.kind === "product" &&
      v.context &&
      !(await db.product.findFirst({
        where: { id: v.context, sellerId: user.seller.id },
      }))
    )
      throw new Error("غير مسموح");
    if (
      v.kind === "kyc" &&
      ["APPROVED", "PENDING"].includes(user.seller.kycStatus)
    )
      throw new Error("غير مسموح");
  }
  return {
    local: false,
    ...(await r2().upload(user.id, v.kind, v.size, v.type)),
  } as const;
}
