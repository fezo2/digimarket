"use client";

import { useActionState, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import type { ActionState } from "@/components/action-form";
import { addPromo, managePromo } from "./actions";

export function NewPromoForm() {
  const { t } = useI18n();
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [state, action, pending] = useActionState(addPromo, {} as ActionState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="label">
        {t("الكود")}
        <input className="input font-mono uppercase" name="code" required maxLength={24} dir="ltr" placeholder="SALE10" />
      </label>
      <div>
        <span className="label">{t("نوع الخصم")}</span>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm">
          {(["percent", "amount"] as const).map((k) => (
            <label key={k} className={`flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-center font-semibold ${kind === k ? "bg-(--surface) shadow-sm" : "text-slate-500"}`}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {k === "percent" ? t("نسبة ٪") : t("مبلغ ثابت")}
            </label>
          ))}
        </div>
      </div>
      <label className="label">
        {kind === "percent" ? t("نسبة الخصم (١–٩٠)") : t("قيمة الخصم بالجنيه")}
        <input className="input" name="value" required inputMode="decimal" maxLength={10} />
      </label>
      <label className="label">
        {t("أقل قيمة للطلب بالجنيه (اختياري)")}
        <input className="input" name="minTotal" inputMode="decimal" maxLength={10} />
      </label>
      <label className="label">
        {t("عدد مرات الاستخدام (اختياري)")}
        <input className="input" name="usageLimit" inputMode="numeric" maxLength={6} />
      </label>
      <label className="label">
        {t("آخر يوم للكود (اختياري)")}
        <input className="input" name="expires" type="date" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
        <button className="btn-primary" disabled={pending}>
          {pending ? t("جاري التنفيذ…") : t("إنشاء الكود")}
        </button>
        {state.error && <p role="alert" className="text-sm text-red-700">{t(state.error)}</p>}
        {state.success && <p role="status" className="text-sm text-emerald-700">{t(state.success)}</p>}
      </div>
    </form>
  );
}

export function PromoButton({
  id,
  operation,
  label,
  className,
}: {
  id: string;
  operation: "on" | "off" | "delete";
  label: string;
  className: string;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(managePromo, {} as ActionState);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (operation === "delete" && !confirm(t("تمسح الكود ده؟"))) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="operation" value={operation} />
      <button disabled={pending} className={className}>{label}</button>
      {state.error && <p role="alert" className="mt-1 text-xs text-red-700">{t(state.error)}</p>}
    </form>
  );
}
