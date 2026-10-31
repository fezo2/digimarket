"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  SupplierImportError,
  importSupplierProducts,
  recategorizeSupplierProducts,
  saveSupplierSettings,
  syncSupplierProducts,
} from "@/lib/supplier";
import { SupplierError } from "@/lib/suppliers/prodseller";
import type { ActionState } from "@/components/action-form";

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

function fail(error: unknown): ActionState {
  if (error instanceof SupplierImportError || error instanceof SupplierError)
    return { error: error.message };
  if (error instanceof z.ZodError)
    return { error: error.issues[0]?.message ?? "راجع البيانات" };
  console.error("Supplier action failed", error);
  return { error: "حصل خطأ، جرّب تاني" };
}

export async function saveSettings(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    await saveSupplierSettings(admin.id, {
      sellerId: text(form, "sellerId"),
      usdRate: text(form, "usdRate"),
      multiplier: text(form, "multiplier"),
    });
    revalidatePath("/", "layout");
    return { success: "الإعدادات اتحفظت والأسعار اتحدثت" };
  } catch (error) {
    return fail(error);
  }
}

export async function importProducts(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    const picks = form
      .getAll("pick")
      .map(String)
      .map((id) => ({ id, categoryId: text(form, `cat_${id}`) }));
    const count = await importSupplierProducts(admin.id, picks);
    revalidatePath("/", "layout");
    return { success: `اتضاف ${count} منتج للمتجر` };
  } catch (error) {
    return fail(error);
  }
}

export async function syncNow(): Promise<ActionState> {
  await requireAdmin();
  try {
    const changed = await syncSupplierProducts();
    revalidatePath("/", "layout");
    return { success: `اتحدّث ${changed} منتج` };
  } catch (error) {
    return fail(error);
  }
}

export async function recategorize(): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    const changed = await recategorizeSupplierProducts(admin.id);
    revalidatePath("/", "layout");
    return { success: `اتنقل ${changed} منتج لقسمه الصح` };
  } catch (error) {
    return fail(error);
  }
}
