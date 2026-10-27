"use client";

import { useI18n } from "@/components/i18n-provider";
import { useActionState } from "react";
import { manageProduct, manageStock } from "./actions";

export function ProductAction({
  id = "",
  operation,
  label,
  className = "btn-outline",
}: {
  id?: string;
  operation: "clone" | "toggle" | "stopAll";
  label: React.ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(manageProduct, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="operation" value={operation} />
      <button disabled={pending} className={className}>
        {pending ? t("لحظة…") : label}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {t(state.error)}
        </p>
      )}
      {state?.message && (
        <p role="status" className="text-sm text-emerald-700">
          {t(state.message)}
        </p>
      )}
    </form>
  );
}

export function StockForm({ id, stockId }: { id: string; stockId?: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(manageStock, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="operation"
        value={stockId ? "delete" : "add"}
      />
      {stockId ? (
        <input type="hidden" name="stockId" value={stockId} />
      ) : (
        <>
          <label className="label" htmlFor="codes">
            {t("كود في كل سطر")}
          </label>
          <textarea
            id="codes"
            name="codes"
            className="input"
            rows={8}
            dir="auto"
          />
          <label className="label" htmlFor="codesFile">
            {t("أو ارفع ملف txt")}
          </label>
          <input
            id="codesFile"
            name="codesFile"
            type="file"
            accept=".txt,text/plain"
            className="input"
          />
        </>
      )}
      <button
        disabled={pending}
        className={stockId ? "btn-danger" : "btn-primary"}
      >
        {pending ? t("لحظة…") : stockId ? t("حذف") : t("إضافة الأكواد")}
      </button>
      {state?.error && (
        <p role="alert" className="text-red-700">
          {t(state.error)}
        </p>
      )}
      {state?.message && (
        <p role="status" className="text-emerald-700">
          {t(state.message)}
        </p>
      )}
    </form>
  );
}
