"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { saveReminderSettings } from "@/lib/checkout-reminders";
import type { ActionState } from "@/components/action-form";

export async function saveReminders(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const delay = Number(form.get("delayMinutes"));
  if (!Number.isFinite(delay)) return { error: "اكتب عدد الدقايق" };
  await saveReminderSettings(admin.id, {
    enabled: form.get("enabled") === "on",
    delayMinutes: delay,
  });
  revalidatePath("/admin/reminders");
  return { success: "الإعدادات اتحفظت" };
}
