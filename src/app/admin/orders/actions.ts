"use server";
import { requireAdmin } from "@/lib/auth";
import { markRefundPaid, refundOrder, redeliverOrder } from "@/lib/wallet";
import { idSchema, noteSchema } from "@/lib/wallet-validation";
import { db } from "@/lib/db";
import { GatewayRefundError, refundThroughKashier } from "@/lib/payments/kashier-refund";
import { walletActionError } from "@/lib/wallet-action-error";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
export async function retryDelivery(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  try {
    const id = idSchema.parse(form.get("id"));
    const changed = await redeliverOrder(actor.id, id);
    revalidatePath("/admin/orders");
    revalidatePath(`/account/orders/${id}`);
    revalidatePath("/seller/wallet");
    return { success: changed ? "الطلب اتسلّم" : "الطلب اتسلّم قبل كده" };
  } catch (error) {
    return walletActionError(error);
  }
}
export async function recordRefund(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  try {
    const id = idSchema.parse(form.get("id"));
    const changed = await refundOrder(
      actor.id,
      id,
      noteSchema.parse(form.get("note")),
    );
    revalidatePath("/admin/orders");
    revalidatePath(`/account/orders/${id}`);
    revalidatePath("/seller/wallet");
    return {
      success: changed ? "استرداد الفلوس اتسجل" : "الطلب اتعالج قبل كده",
    };
  } catch (error) {
    return walletActionError(error);
  }
}
export async function confirmRefundPaid(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  try {
    const id = idSchema.parse(form.get("id"));
    const changed = await markRefundPaid(actor.id, id);
    revalidatePath("/admin/orders");
    revalidatePath("/admin", "layout");
    return { success: changed ? "اتسجل إن الفلوس رجعت للمشتري" : "اتسجل قبل كده" };
  } catch (error) {
    return walletActionError(error);
  }
}

// Card payments: take the sale back from the seller (if not done yet) and
// send the money back to the buyer's card or wallet through Kashier.
export async function refundViaKashier(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  try {
    const id = idSchema.parse(form.get("id"));
    const order = await db.order.findUnique({ where: { id }, select: { status: true } });
    if (order?.status === "PAID")
      await refundOrder(actor.id, id, noteSchema.parse(form.get("note")));
    const status = await refundThroughKashier(actor.id, id);
    revalidatePath("/admin/orders");
    revalidatePath("/admin", "layout");
    revalidatePath(`/account/orders/${id}`);
    revalidatePath("/seller/wallet");
    return {
      success:
        status === "PENDING"
          ? "كاشير استلم الاسترداد وهو تحت التنفيذ"
          : "الفلوس رجعت للمشتري عبر كاشير",
    };
  } catch (error) {
    if (error instanceof GatewayRefundError) {
      revalidatePath("/admin/orders");
      return { error: error.message };
    }
    return walletActionError(error);
  }
}
