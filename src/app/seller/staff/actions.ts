"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireSeller, requireUser } from "@/lib/auth";
import {
  StaffError,
  addStaff,
  leaveStore,
  removeStaff,
  updateStaff,
} from "@/lib/seller-staff-db";
import type { ActionState } from "@/components/action-form";

function staffError(error: unknown): ActionState {
  if (error instanceof StaffError) return { error: error.message };
  if (error instanceof ZodError) return { error: error.issues[0]?.message ?? "البيانات مش صحيحة" };
  throw error;
}

export async function addStaffAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { seller } = await requireSeller();
  try {
    await addStaff(seller.id, String(form.get("email") ?? ""), form.getAll("permissions"));
    revalidatePath("/seller/staff");
    return { success: "الموظف اتضاف. يدخل من موقع التجار بإيميله وباسورده" };
  } catch (error) {
    return staffError(error);
  }
}

export async function updateStaffAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { seller } = await requireSeller();
  try {
    await updateStaff(seller.id, String(form.get("id") ?? ""), form.getAll("permissions"));
    revalidatePath("/seller/staff");
    return { success: "الصلاحيات اتحفظت" };
  } catch (error) {
    return staffError(error);
  }
}

export async function removeStaffAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { seller } = await requireSeller();
  try {
    await removeStaff(seller.id, String(form.get("id") ?? ""));
    revalidatePath("/seller/staff");
    return { success: "الموظف اتشال" };
  } catch (error) {
    return staffError(error);
  }
}

export async function leaveStoreAction() {
  const user = await requireUser("/seller");
  await leaveStore(user.id);
  redirect("/seller/join");
}
