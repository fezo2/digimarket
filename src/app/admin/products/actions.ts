"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { moderateProduct } from "@/lib/product-moderation";
import { STAFF_DENIED } from "@/lib/staff-scope";

export async function reviewProduct(
  _: { error?: string } | undefined,
  form: FormData,
) {
  const actor = await requireAdmin();
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
  let result;
  try {
    result = await moderateProduct(actor.id, v);
  } catch (error) {
    if (error instanceof Error && error.message === STAFF_DENIED)
      return { error: STAFF_DENIED };
    throw error;
  }
  if (!result.count) return { error: "الطلب اتراجع بالفعل أو التاجر مش موثّق" };
  revalidatePath("/", "layout");
  redirect("/admin/products");
}
