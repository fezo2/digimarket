"use server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { participant } from "@/lib/chat";
import { chatActorId } from "@/lib/seller-staff-db";
import { canAccess, sellerAccessOf } from "@/lib/seller-staff";
import { r2 } from "@/lib/r2";
import { z } from "zod";
import { withinLimit } from "@/lib/account-security";
export async function createUploadUrl(
  kind: unknown,
  size: unknown,
  type: unknown,
  context: unknown,
) {
  const user = await requireUser();
  const v = z
    .object({
      kind: z.enum(["product", "kyc", "chat", "receipt"]),
      size: z.number().int().positive(),
      type: z.string().max(100),
      context: z.string().max(100),
    })
    .parse({ kind, size, type, context });
  if (process.env.STORAGE_DRIVER !== "r2") return { local: true } as const;
  // Each signed URL lets the browser put a file straight into the bucket.
  if (!(await withinLimit("upload-url:" + user.id, 40, 3600000)))
    throw new Error("رفعت ملفات كتير، جرّب بعد شوية");
  if (v.kind === "chat")
    await participant(db, await chatActorId(user, v.context), v.context);
  else if (v.kind === "receipt") {
    if (
      !(await db.order.findFirst({
        where: {
          id: v.context,
          buyerId: user.id,
          status: "PENDING_PAYMENT",
          paymentProvider: "manual",
          manualPayment: null,
        },
      }))
    )
      throw new Error("غير مسموح");
  } else {
    // Product files: the owner or staff with products; KYC: the owner only.
    const access = sellerAccessOf(user);
    const seller =
      access && canAccess(access, v.kind === "product" ? "PRODUCTS" : "OWNER")
        ? access.seller
        : null;
    if (!seller || (v.kind === "product" && seller.kycStatus !== "APPROVED"))
      throw new Error("غير مسموح");
    if (
      v.kind === "product" &&
      v.context &&
      !(await db.product.findFirst({
        where: { id: v.context, sellerId: seller.id },
      }))
    )
      throw new Error("غير مسموح");
    if (v.kind === "kyc" && ["APPROVED", "PENDING"].includes(seller.kycStatus))
      throw new Error("غير مسموح");
  }
  return {
    local: false,
    ...(await r2().upload(user.id, v.kind, v.size, v.type)),
  } as const;
}
