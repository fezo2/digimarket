"use server";
import { redirect } from "next/navigation";
import { currentSite, requireUser } from "@/lib/auth";
import {
  sendVerificationEmail,
  verificationOrigin,
  verifyEmail,
} from "@/lib/email-verification";
import { SITE_HOME, safeRedirectPath } from "@/lib/sites";

export async function resendVerification(
  _: { error?: string; success?: string },
  form: FormData,
) {
  void form;
  const user = await requireUser("/verify-email");
  try {
    const sent = await sendVerificationEmail(
      user,
      verificationOrigin(await currentSite()),
    );
    if (sent === "limited") return { error: "محاولات كتير، جرّب بعد شوية" };
    if (sent === "verified") return { success: "إيميلك متأكد خلاص" };
    return { success: "بعتنالك لينك جديد، بص على الإيميل (وفولدر الـ Spam)" };
  } catch {
    console.error("Verification email delivery failed");
    return { error: "الإيميل ماتبعتش، جرّب تاني بعد شوية" };
  }
}

// A button rather than verifying on page load, so mail scanners that open
// links don't confirm the address on the user's behalf.
export async function confirmEmail(
  _: { error?: string; success?: string },
  form: FormData,
) {
  const token = form.get("token");
  const verified = typeof token === "string" && (await verifyEmail(token));
  if (!verified)
    return { error: "اللينك منتهي أو اتستخدم. سجّل دخول واطلب لينك جديد" };
  redirect(
    safeRedirectPath(form.get("next")) ?? SITE_HOME[await currentSite()],
  );
}
