"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function reviewProduct(
  _: { error?: string } | undefined,
  form: FormData,
) {
  await requireAdmin();
  const parsed = z
    .object({
      id: z.string().min(1),
      decision: z.enum(["ACTIVE", "REJECTED"]),
      reviewNote: z.string().trim().max(2000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "راجع بيانات الطلب" };
  const v = parsed.data;
  if (v.decision === "REJECTED" && !v.reviewNote)
    return { error: "اكتب سبب الرفض" };
  const result = await db.product.updateMany({
    where: {
      id: v.id,
      status: "PENDING_REVIEW",
      seller: { kycStatus: "APPROVED" },
    },
    data: {
      status: v.decision,
      reviewNote: v.decision === "REJECTED" ? v.reviewNote : null,
    },
  });
  if (!result.count) return { error: "الطلب اتراجع بالفعل أو التاجر مش موثّق" };
  revalidatePath("/", "layout");
  redirect("/admin/products");
}
