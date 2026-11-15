"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, requireVerifiedUser } from "@/lib/auth";
import {
  AffiliateError,
  joinAffiliate,
  requestAffiliatePayout,
  saveAffiliateDestination,
} from "@/lib/affiliate";
import { amountSchema, destinationSchema, passwordSchema } from "@/lib/wallet-validation";
import type { ActionState } from "@/components/action-form";

function failure(error: unknown): ActionState {
  if (error instanceof AffiliateError) return { error: error.message };
  if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "راجع البيانات" };
  console.error("Affiliate action failed", { kind: error instanceof Error ? error.name : "unknown" });
  return { error: "حصل خطأ، جرّب تاني" };
}

export async function join(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser("/account/affiliate");
  try {
    await joinAffiliate(user.id, String(form.get("code") ?? ""));
    revalidatePath("/account/affiliate");
    return { success: "أهلاً بيك في برنامج الإحالة" };
  } catch (error) {
    return failure(error);
  }
}

export async function saveAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser("/account/affiliate");
  try {
    const value = destinationSchema.parse(Object.fromEntries(form));
    await saveAffiliateDestination(user.id, value, passwordSchema.parse(form.get("password")));
    revalidatePath("/account/affiliate");
    return { success: "بيانات الحساب اتحفظت" };
  } catch (error) {
    return failure(error);
  }
}

export async function askPayout(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser("/account/affiliate");
  try {
    await requestAffiliatePayout(user.id, amountSchema.parse(form.get("amount")));
    revalidatePath("/account/affiliate");
    revalidatePath("/admin/affiliates/payouts");
    return { success: "طلب السحب اتسجل والرصيد اتخصم" };
  } catch (error) {
    return failure(error);
  }
}
