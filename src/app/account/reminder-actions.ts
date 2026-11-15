"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { setRemindersOff } from "@/lib/checkout-reminders";

export async function toggleCheckoutReminders(form: FormData) {
  const user = await requireUser("/account");
  await setRemindersOff(user.id, form.get("off") === "1");
  revalidatePath("/account");
}
