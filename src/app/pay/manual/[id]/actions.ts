"use server";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatEGP } from "@/lib/money";
import { alertAdmin } from "@/lib/notifications";
import { siteHref } from "@/lib/sites";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { manualActionError, submitManualPayment } from "@/lib/manual-payments";
import { startAutoPayment } from "@/lib/auto-payments";
import { OrderError } from "@/lib/orders";
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
  after(async () => {
    const order = await db.order.findUnique({
      where: { id },
      select: { number: true, total: true },
    });
    if (order)
      await alertAdmin(
        [
          "💳 تحويل يدوي جديد مستني تأكيدك",
          `طلب #${order.number} · ${formatEGP(order.total)}`,
          siteHref("admin", "/admin/payments"),
        ].join("\n"),
      );
  });
  redirect(`/account/orders/${id}`);
}

export async function setPayFrom(
  id: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser(`/pay/manual/${id}`);
  try {
    await startAutoPayment(id, user.id, String(form.get("payFrom") ?? ""));
  } catch (error) {
    if (error instanceof OrderError) return { error: error.message };
    return manualActionError(error);
  }
  revalidatePath(`/pay/manual/${id}`);
  return {};
}
