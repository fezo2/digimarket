"use client";

import { useI18n } from "@/components/i18n-provider";
import { useActionState } from "react";
import { joinAsSeller } from "../actions";

export function JoinForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(joinAsSeller, undefined);
  return (
    <form action={action} className="card space-y-4 p-6">
      <div>
        <label className="label" htmlFor="storeName">{t("اسم المتجر")}</label>
        <input id="storeName" name="storeName" required minLength={3} maxLength={40} className="input" />
      </div>
      <fieldset>
        <legend className="label">{t("نوع الحساب")}</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="type" value="INDIVIDUAL" defaultChecked />{t("فرد")}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="type" value="COMPANY" />{t("شركة")}
          </label>
        </div>
      </fieldset>
      {state?.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{t(state.error)}</p>}
      <button disabled={pending} className="btn-primary">{pending ? t("لحظة…") : t("اعمل المتجر وكمّل للتوثيق")}</button>
    </form>
  );
}
