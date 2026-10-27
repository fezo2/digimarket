"use client";
import { useI18n } from "@/components/i18n-provider";
import { useActionState, useRef } from "react";
import { testPayment } from "./actions";
export function TestForm({ id }: { id: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(
    testPayment.bind(null, id),
    undefined,
  );
  const decision = useRef<HTMLInputElement>(null);
  return (
    <form action={action} className="space-y-3">
      <input
        ref={decision}
        type="hidden"
        name="decision"
        defaultValue="failure"
      />
      <div className="flex gap-3">
        <button
          disabled={pending}
          className="btn-primary"
          onClick={() => {
            if (decision.current) decision.current.value = "success";
          }}
        >
          {t("دفع ناجح")}
        </button>
        <button
          disabled={pending}
          className="btn-danger"
          onClick={() => {
            if (decision.current) decision.current.value = "failure";
          }}
        >
          {t("دفع فاشل")}
        </button>
      </div>
      {state?.error && <p role="alert">{t(state.error)}</p>}
    </form>
  );
}
