"use server";
import { z } from "zod";
import {
  requestPasswordReset,
  deliverResetEmail,
  resetPassword,
  AccountError,
  withinLimit,
} from "@/lib/account-security";
import { CAPTCHA_ERROR, captchaPassed, clientIp } from "@/lib/captcha";
export async function forgotPassword(
  _: { error?: string; success?: string },
  form: FormData,
) {
  const email = z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(254)
    .safeParse(form.get("email"));
  if (!(await captchaPassed(form))) return { error: CAPTCHA_ERROR };
  if (!(await withinLimit("forgot:" + (await clientIp()), 10, 3600000)))
    return { error: "محاولات كتير، جرّب بعد شوية" };
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
      password: z.string().max(200),
    })
    .safeParse(Object.fromEntries(form));
  if (!v.success) return { error: "اللينك منتهي أو اتستخدم" };
  if (!(await captchaPassed(form))) return { error: CAPTCHA_ERROR };
  try {
    await resetPassword(v.data.token, v.data.password);
    return { success: "الباسورد اتغير. سجّل دخول بالباسورد الجديد" };
  } catch (e) {
    return {
      error: e instanceof AccountError ? e.message : "حصل خطأ، جرّب تاني",
    };
  }
}
