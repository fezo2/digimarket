"use server";
import { requireAdmin } from "@/lib/auth";
import { adjustLedger } from "@/lib/wallet";
import {
  idSchema,
  noteSchema,
  adjustmentSchema,
  passwordSchema,
} from "@/lib/wallet-validation";
import { walletActionError } from "@/lib/wallet-action-error";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
export async function manualAdjustment(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  try {
    const sellerId = idSchema.parse(form.get("sellerId"));
    await adjustLedger(
      actor.id,
      sellerId,
      adjustmentSchema.parse(form.get("amount")),
      noteSchema.parse(form.get("note")),
      passwordSchema.parse(form.get("password")),
    );
    revalidatePath(`/admin/sellers/${sellerId}/ledger`);
    revalidatePath("/seller/wallet");
    return { success: "التسوية اتسجلت" };
  } catch (error) {
    return walletActionError(error);
  }
}
