"use server";
import { requireSeller } from "@/lib/auth";
import { saveDestination, requestPayout } from "@/lib/wallet";
import {
  amountSchema,
  destinationSchema,
  passwordSchema,
} from "@/lib/wallet-validation";
import { walletActionError } from "@/lib/wallet-action-error";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
export async function saveAccount(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireSeller();
  try {
    const value = destinationSchema.parse(Object.fromEntries(form));
    const password = passwordSchema.parse(form.get("password"));
    await saveDestination(user.id, value, password);
    revalidatePath("/seller/wallet");
    return { success: "بيانات الحساب اتحفظت" };
  } catch (error) {
    return walletActionError(error);
  }
}
export async function askPayout(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireSeller();
  try {
    await requestPayout(user.id, amountSchema.parse(form.get("amount")));
    revalidatePath("/seller/wallet");
    revalidatePath("/admin/payouts");
    return { success: "طلب السحب اتسجل والرصيد اتخصم" };
  } catch (error) {
    return walletActionError(error);
  }
}
