"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { manualActionError, submitManualPayment } from "@/lib/manual-payments";
import type { ActionState } from "@/components/action-form";

export async function sendManualPayment(
  id: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser(`/pay/manual/${id}`);
  const pending = form.get("receiptPending");
  const file = form.get("receipt");
  try {
    await submitManualPayment(
      user.id,
      id,
      {
        method: form.get("method"),
        senderAccount: form.get("senderAccount"),
        reference: form.get("reference"),
      },
      typeof pending === "string" && pending
        ? pending
        : file instanceof File
          ? file
          : null,
    );
  } catch (error) {
    return manualActionError(error);
  }
  revalidatePath("/admin/payments");
  redirect(`/account/orders/${id}`);
}
