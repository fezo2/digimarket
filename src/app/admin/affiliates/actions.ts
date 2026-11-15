"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  AffiliateError,
  cancelAffiliateCommission,
  processAffiliatePayout,
  saveAffiliateSettings,
  setAffiliateRate,
  suspendAffiliate,
  unsuspendAffiliate,
} from "@/lib/affiliate";
import type { ActionState } from "@/components/action-form";

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

async function run(work: (actorId: string) => Promise<unknown>, done: string, again = "اتنفّذ قبل كده"): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    const changed = await work(admin.id);
    revalidatePath("/admin/affiliates", "layout");
    revalidatePath("/account/affiliate");
    return { success: changed === false ? again : done };
  } catch (error) {
    if (error instanceof AffiliateError) return { error: error.message };
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "راجع البيانات" };
    console.error("Affiliate admin action failed", { kind: error instanceof Error ? error.name : "unknown" });
    return { error: "حصل خطأ، جرّب تاني" };
  }
}

export async function settings(_: ActionState, form: FormData) {
  return run(
    (a) =>
      saveAffiliateSettings(a, {
        enabled: form.get("enabled") === "on",
        rate: text(form, "rate"),
        holdDays: text(form, "holdDays"),
        minPayout: text(form, "minPayout"),
      }),
    "الإعدادات اتحفظت",
  );
}

export async function rate(_: ActionState, form: FormData) {
  return run((a) => setAffiliateRate(a, text(form, "id"), text(form, "rate")), "النسبة اتحفظت");
}

export async function suspension(_: ActionState, form: FormData) {
  const id = text(form, "id");
  if (form.get("suspend") === "true")
    return run((a) => suspendAffiliate(a, id, text(form, "reason"), form.get("reverse") === "on"), "المسوّق اتوقف");
  return run((a) => unsuspendAffiliate(a, id), "الإيقاف اتشال");
}

export async function cancelCommission(_: ActionState, form: FormData) {
  return run((a) => cancelAffiliateCommission(a, text(form, "entryId"), text(form, "reason")), "العمولة اتلغت");
}

export async function payout(_: ActionState, form: FormData) {
  const status = form.get("status") === "PAID" ? "PAID" : "REJECTED";
  return run((a) => processAffiliatePayout(a, text(form, "id"), status, text(form, "text")), "طلب السحب اتعالج", "الطلب اتعالج قبل كده");
}
