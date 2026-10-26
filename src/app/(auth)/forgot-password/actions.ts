"use server";
import { z } from "zod";
import {
  requestPasswordReset,
  deliverResetEmail,
  resetPassword,
  AccountError,
} from "@/lib/account-security";
export async function forgotPassword(
  _: { error?: string; success?: string },
  form: FormData,
) {
  const email = z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .safeParse(form.get("email"));
  if (email.success && process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
    await requestPasswordReset(email.data, deliverResetEmail);
  return { success: "لو الإيميل مسجل هيوصلك لينك" };
}
export async function applyReset(
  _: { error?: string; success?: string },
  form: FormData,
) {
  const v = z
    .object({
      token: z.string().regex(/^[a-f0-9]{64}$/),
      password: z.string().min(8).max(200),
    })
    .safeParse(Object.fromEntries(form));
  if (!v.success)
    return { error: "راجع اللينك والباسورد لازم ٨ حروف على الأقل" };
  try {
    await resetPassword(v.data.token, v.data.password);
    return { success: "الباسورد اتغير. سجّل دخول بالباسورد الجديد" };
  } catch (e) {
    return {
      error: e instanceof AccountError ? e.message : "حصل خطأ، جرّب تاني",
    };
  }
}
