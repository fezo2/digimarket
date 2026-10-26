"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  confirmManualPayment,
  manualActionError,
  rejectManualPayment,
} from "@/lib/manual-payments";
import { amountSchema, idSchema } from "@/lib/wallet-validation";
import type { ActionState } from "@/components/action-form";

export async function handleManualPayment(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  try {
    const v = z
      .discriminatedUnion("decision", [
        z.object({
          decision: z.literal("confirm"),
          id: idSchema,
          amount: amountSchema,
          note: z.string().max(500).default(""),
        }),
        z.object({
          decision: z.literal("reject"),
          id: idSchema,
          note: z.string().max(500),
        }),
      ])
      .parse(Object.fromEntries(form));
    const changed =
      v.decision === "confirm"
        ? await confirmManualPayment(actor.id, v.id, v.amount, v.note)
        : await rejectManualPayment(actor.id, v.id, v.note);
    revalidatePath("/admin/payments");
    return {
      success: changed
        ? v.decision === "confirm"
          ? "الدفع اتأكد والطلب اتسلّم لو البيانات سليمة"
          : "التحويل اترفض والطلب اتلغى"
        : "التحويل اتعالج قبل كده",
    };
  } catch (error) {
    return manualActionError(error);
  }
}
