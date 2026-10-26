"use server";
import { requireAdmin } from "@/lib/auth";
import { processPayout } from "@/lib/wallet";
import { idSchema, noteSchema } from "@/lib/wallet-validation";
import { walletActionError } from "@/lib/wallet-action-error";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
export async function handlePayout(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  try {
    const v = z
      .object({
        id: idSchema,
        status: z.enum(["PAID", "REJECTED"]),
        text: noteSchema,
      })
      .parse(Object.fromEntries(form));
    const changed = await processPayout(actor.id, v.id, v.status, v.text);
    revalidatePath("/admin/payouts");
    revalidatePath("/seller/wallet");
    return { success: changed ? "طلب السحب اتعالج" : "الطلب اتعالج قبل كده" };
  } catch (error) {
    return walletActionError(error);
  }
}
