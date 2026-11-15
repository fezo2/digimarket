"use client";
import { useActionState, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { confirmTwoFactorLogin, type FormState } from "../../actions";

export function TwoFactorLoginForm() {
  const { t } = useI18n();
  const [backup, setBackup] = useState(false);
  const [state, submit, pending] = useActionState<FormState, FormData>(
    confirmTwoFactorLogin,
    undefined,
  );
  return (
    <form action={submit} className="space-y-3">
      <label className="label" htmlFor="code">
        {backup ? t("كود احتياطي") : t("كود التطبيق")}
      </label>
      {backup ? (
        <input
          key="backup"
          id="code"
          name="code"
          required
          autoComplete="off"
          maxLength={20}
          dir="ltr"
          placeholder="xxxx-xxxx"
          className="input text-center text-xl tracking-widest"
          autoFocus
        />
      ) : (
        <input
          key="totp"
          id="code"
          name="code"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          dir="ltr"
          className="input text-center text-2xl tracking-[0.5em]"
          autoFocus
        />
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">{t(state.error)}</p>
      )}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? t("لحظة…") : t("دخول")}
      </button>
      <button
        type="button"
        className="text-sm font-semibold text-brand-600"
        onClick={() => setBackup((b) => !b)}
      >
        {backup ? t("استخدم كود التطبيق") : t("مش معاك الموبايل؟ استخدم كود احتياطي")}
      </button>
    </form>
  );
}
