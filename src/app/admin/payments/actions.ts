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
import { setWalletBalance, vouchForNotice } from "@/lib/auto-payments";
import { OrderError } from "@/lib/orders";
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

export async function vouchNotice(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  try {
    const paid = await vouchForNotice(actor.id, idSchema.parse(form.get("id")));
    revalidatePath("/admin/payments");
    return {
      success: paid
        ? "اتأكد، والرصيد ده بقى المرجع للتحويلات الجاية"
        : "الرسالة اتأكدت بس الطلب محتاج مراجعة في صفحة الطلبات",
    };
  } catch (error) {
    if (error instanceof OrderError) return { error: error.message };
    return manualActionError(error);
  }
}

export async function saveWalletBalance(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  try {
    await setWalletBalance(actor.id, amountSchema.parse(form.get("balance")));
    revalidatePath("/admin/payments");
    return { success: "الرصيد اتسجل، التحويلات الجاية هتتأكد على أساسه" };
  } catch (error) {
    if (error instanceof OrderError) return { error: error.message };
    return manualActionError(error);
  }
}
