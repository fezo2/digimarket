"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { headers } from "next/headers";
import { authenticate, AccountError } from "@/lib/account-security";
import { db } from "@/lib/db";
import {
  createSession,
  currentSite,
  destroySession,
  hashPassword,
} from "@/lib/auth";
import { SITE_HOME } from "@/lib/sites";

export type FormState = { error?: string } | undefined;

async function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && next !== "/"
    ? next
    : SITE_HOME[await currentSite()];
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "اكتب اسمك"),
  email: z.string().trim().toLowerCase().email("الإيميل مش صحيح"),
  password: z.string().min(8, "الباسورد لازم 8 حروف على الأقل"),
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
  redirect(
    (await currentSite()) === "seller"
      ? "/seller/join"
      : await safeNext(form.get("next")),
  );
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email().max(254),
      password: z.string().max(200),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "الإيميل أو الباسورد غلط" };
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  let user;
  try {
    user = await authenticate(parsed.data.email, parsed.data.password, ip);
  } catch (e) {
    if (e instanceof AccountError) return { error: e.message };
    throw e;
  }
  if (!user) return { error: "الإيميل أو الباسورد غلط" };
  if ((await currentSite()) === "admin" && user.role !== "ADMIN")
    return { error: "الحساب ده مش حساب إدارة" };
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
