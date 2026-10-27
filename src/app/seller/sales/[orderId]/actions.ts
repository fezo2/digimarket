"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth";
import { sellerRefundOrder } from "@/lib/wallet";
import { walletActionError } from "@/lib/wallet-action-error";
import { alertAdmin } from "@/lib/notifications";
import { formatEGP } from "@/lib/money";
import { siteHref } from "@/lib/sites";
import type { ActionState } from "@/components/action-form";

export async function refundSale(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSeller();
  const id = String(form.get("id") ?? "");
  try {
    if (form.get("confirm") !== "on") return { error: "أكّد إنك عاوز ترجّع الفلوس" };
    const order = await sellerRefundOrder(user.id, id, String(form.get("note") ?? ""));
    if (!order) return { error: "الطلب ده اتردّ قبل كده أو مش مدفوع" };
    revalidatePath(`/seller/sales/${id}`);
    revalidatePath("/seller/sales");
    revalidatePath("/seller/wallet");
    revalidatePath(`/account/orders/${id}`);
    after(() =>
      alertAdmin(
        [
          "↩️ تاجر عمل استرداد، حوّل الفلوس للمشتري",
          `طلب #${order.number} · ${formatEGP(order.paidAmount ?? order.total)}`,
          siteHref("admin", "/admin/orders?repay=1"),
        ].join("\n"),
      ),
    );
    return { success: "الاسترداد اتسجل، والإدارة هترجّع الفلوس للمشتري" };
  } catch (error) {
    return walletActionError(error);
  }
}
