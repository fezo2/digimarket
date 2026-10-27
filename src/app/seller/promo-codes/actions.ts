"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSeller } from "@/lib/auth";
import { createPromo, deletePromo, setPromoActive } from "@/lib/promo-codes";
import { toolError } from "@/lib/seller-tools";
import type { ActionState } from "@/components/action-form";

const field = (form: FormData, name: string) => String(form.get(name) ?? "");

export async function addPromo(_: ActionState, form: FormData): Promise<ActionState> {
  const { seller } = await requireSeller();
  try {
    await createPromo(seller.id, {
      code: field(form, "code"),
      kind: field(form, "kind") as "percent" | "amount",
      value: field(form, "value"),
      minTotal: field(form, "minTotal"),
      usageLimit: field(form, "usageLimit"),
      expires: field(form, "expires"),
    });
  } catch (error) {
    return toolError(error);
  }
  revalidatePath("/seller/promo-codes");
  return { success: "كود الخصم اتعمل" };
}

const manage = z.object({
  id: z.string().min(1).max(40),
  operation: z.enum(["on", "off", "delete"]),
});

export async function managePromo(_: ActionState, form: FormData): Promise<ActionState> {
  const { seller } = await requireSeller();
  const v = manage.safeParse({ id: form.get("id"), operation: form.get("operation") });
  if (!v.success) return { error: "طلب مش صحيح" };
  try {
    const ok =
      v.data.operation === "delete"
        ? await deletePromo(seller.id, v.data.id)
        : await setPromoActive(seller.id, v.data.id, v.data.operation === "on");
    if (!ok) return { error: "الكود مش موجود" };
  } catch (error) {
    return toolError(error);
  }
  revalidatePath("/seller/promo-codes");
  return {};
}
