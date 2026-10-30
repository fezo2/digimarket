"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { headers } from "next/headers";
import { after } from "next/server";
import { alertAdmin } from "@/lib/notifications";
import {
  authenticate,
  AccountError,
  withinLimit,
} from "@/lib/account-security";
import { CAPTCHA_ERROR, captchaPassed, clientIp } from "@/lib/captcha";
import { passwordProblem } from "@/lib/password-policy";
import {
  sendVerificationEmail,
  verificationOrigin,
  verificationRequired,
} from "@/lib/email-verification";
import { db } from "@/lib/db";
import {
  createSession,
  currentSite,
  destroySession,
  hashPassword,
  requireUser,
} from "@/lib/auth";
import { changePassword, toolError } from "@/lib/seller-tools";
import type { ActionState } from "@/components/action-form";
import { SITE_HOME, safeRedirectPath } from "@/lib/sites";

export type FormState = { error?: string } | undefined;

async function safeNext(value: FormDataEntryValue | null) {
  const next = safeRedirectPath(value);
  return next && next !== "/" ? next : SITE_HOME[await currentSite()];
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "اكتب اسمك").max(80, "الاسم طويل أوي"),
  email: z.string().trim().toLowerCase().email("الإيميل مش صحيح").max(254, "الإيميل مش صحيح"),
  password: z.string().max(200, "الباسورد طويل أوي"),
});

export async function register(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  if ((await currentSite()) === "admin")
    return { error: "حسابات الإدارة مش بتتعمل من هنا" };
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { name, email, password } = parsed.data;
  const weak = passwordProblem(password, email);
  if (weak) return { error: weak };
  if (!(await captchaPassed(form))) return { error: CAPTCHA_ERROR };
  if (!(await withinLimit("register:" + (await clientIp()), 5, 3600000)))
    return { error: "محاولات كتير، جرّب بعد شوية" };
  if (await db.user.findUnique({ where: { email } })) {
    return { error: "الإيميل ده مسجّل قبل كده" };
  }

  const user = await db.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
  });
  await createSession({
    userId: user.id,
    role: user.role,
    sessionVersion: user.sessionVersion,
  });
  const site = await currentSite();
  const next = site === "seller" ? "/seller/join" : await safeNext(form.get("next"));
  if (!verificationRequired()) redirect(next);
  const origin = verificationOrigin(site);
  after(() =>
    sendVerificationEmail(user, origin).catch(() =>
      console.error("Verification email delivery failed"),
    ),
  );
  redirect(`/verify-email?next=${encodeURIComponent(next)}`);
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email().max(254),
      password: z.string().max(200),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "الإيميل أو الباسورد غلط" };
  if (!(await captchaPassed(form))) return { error: CAPTCHA_ERROR };
  const h = await headers();
  const ip = await clientIp();
  const where = `${ip} ${h.get("x-vercel-ip-country") ?? ""}`.trim();
  const adminSite = (await currentSite()) === "admin";
  let user;
  try {
    user = await authenticate(parsed.data.email, parsed.data.password, ip);
  } catch (e) {
    if (e instanceof AccountError) {
      // Someone is hammering the admin login: tell the owner.
      if (adminSite)
        after(() => alertAdmin(`🚨 محاولات دخول كتير على لوحة الإدارة\n${parsed.data.email} · ${where}`));
      return { error: e.message };
    }
    throw e;
  }
  if (!user) return { error: "الإيميل أو الباسورد غلط" };
  if (adminSite && user.role !== "ADMIN")
    return { error: "الحساب ده مش حساب إدارة" };
  if (adminSite)
    after(() => alertAdmin(`🔐 دخول جديد على لوحة الإدارة\n${user.email} · ${where}`));
  await createSession({
    userId: user.id,
    role: user.role,
    sessionVersion: user.sessionVersion,
  });
  redirect(await safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function updatePassword(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    const fresh = await changePassword(user.id, {
      current: String(form.get("current") ?? ""),
      next: String(form.get("next") ?? ""),
    });
    // Re-issue this device's cookie; every other session is now invalid.
    await createSession({
      userId: fresh.id,
      role: fresh.role,
      sessionVersion: fresh.sessionVersion,
    });
    return { success: "الباسورد اتغيّر، وكل الأجهزة التانية اتعمل لها خروج" };
  } catch (error) {
    return toolError(error);
  }
}
