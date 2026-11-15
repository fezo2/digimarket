"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSeller } from "@/lib/auth";
import {
  assignStoreCategory,
  createStoreCategory,
  deleteStoreCategory,
  moveStoreCategory,
  renameStoreCategory,
} from "@/lib/store-categories";
import { toolError } from "@/lib/seller-tools";
import type { ActionState } from "@/components/action-form";

const id = z.string().min(1).max(40);

function refresh() {
  revalidatePath("/seller/store-categories");
  revalidatePath("/seller/products", "layout");
}

export async function addStoreCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const { seller } = await requireSeller("PRODUCTS");
  try {
    await createStoreCategory(seller.id, String(form.get("name") ?? ""));
  } catch (error) {
    return toolError(error);
  }
  refresh();
  return { success: "التصنيف اتضاف" };
}

const manage = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("rename"), id, name: z.string().max(200) }),
  z.object({ operation: z.enum(["up", "down", "delete"]), id }),
]);

export async function manageStoreCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const { seller } = await requireSeller("PRODUCTS");
  const v = manage.safeParse(Object.fromEntries(form));
  if (!v.success) return { error: "طلب مش صحيح" };
  let ok: boolean | undefined;
  try {
    const d = v.data;
    ok =
      d.operation === "rename"
        ? await renameStoreCategory(seller.id, d.id, d.name)
        : d.operation === "delete"
          ? await deleteStoreCategory(seller.id, d.id)
          : await moveStoreCategory(seller.id, d.id, d.operation);
  } catch (error) {
    return toolError(error);
  }
  if (!ok && v.data.operation !== "up" && v.data.operation !== "down")
    return { error: "التصنيف غير موجود" };
  refresh();
  return v.data.operation === "rename" ? { success: "اتحفظ" } : {};
}

const assign = z.object({
  productId: id,
  storeCategoryId: z.union([z.literal(""), id]),
});

// Quick change from the products table, one product at a time.
export async function setProductStoreCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const { seller } = await requireSeller("PRODUCTS");
  const v = assign.safeParse(Object.fromEntries(form));
  if (!v.success) return { error: "طلب مش صحيح" };
  try {
    const n = await assignStoreCategory(seller.id, [v.data.productId], v.data.storeCategoryId || null);
    if (!n) return { error: "المنتج غير موجود" };
  } catch (error) {
    return toolError(error);
  }
  refresh();
  revalidatePath("/", "layout");
  return { success: "اتحفظ" };
}
