"use client";

import { useI18n } from "@/components/i18n-provider";
import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/(auth)/actions";

type Props = {
  mode: "login" | "register";
  action: (state: FormState, form: FormData) => Promise<FormState>;
  next?: string;
  title?: string;
  allowSignup?: boolean;
};

export function AuthForm({ mode, action, next, title, allowSignup = true }: Props) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, undefined);
  const isRegister = mode === "register";

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card p-6 sm:p-8">
        <h1 className="mb-6 text-2xl font-bold">{title ?? (isRegister ? t("حساب جديد") : t("تسجيل الدخول"))}</h1>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next ?? "/"} />
          {isRegister && (
            <div>
              <label className="label" htmlFor="name">{t("الاسم")}</label>
              <input id="name" name="name" required className="input" autoComplete="name" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">{t("الإيميل")}</label>
            <input id="email" name="email" type="email" required dir="ltr" className="input" autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">{t("الباسورد")}</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={isRegister ? 8 : undefined}
              dir="ltr"
              className="input"
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>
          {state?.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{t(state.error)}</p>}
          <button disabled={pending} className="btn-primary w-full">
            {pending ? t("لحظة…") : isRegister ? t("إنشاء الحساب") : t("دخول")}
          </button>
        </form>
        {allowSignup && <p className="mt-6 text-center text-sm text-slate-600">
          {isRegister ? t("عندك حساب؟ ") : t("معندكش حساب؟ ")}
          <Link
            href={`${isRegister ? "/login" : "/register"}${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-semibold text-brand-600"
          >
            {isRegister ? t("سجّل دخول") : t("اعمل حساب")}
          </Link>
        </p>}
      </div>
    </div>
  );
}
