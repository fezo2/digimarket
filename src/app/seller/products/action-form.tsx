"use client";

import { useActionState } from "react";
import { manageProduct, manageStock } from "./actions";

export function ProductAction({
  id = "",
  operation,
  label,
}: {
  id?: string;
  operation: "clone" | "toggle" | "stopAll";
  label: string;
}) {
  const [state, action, pending] = useActionState(manageProduct, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="operation" value={operation} />
      <button disabled={pending} className="btn-outline">
        {pending ? "لحظة…" : label}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="text-sm text-emerald-700">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function StockForm({ id, stockId }: { id: string; stockId?: string }) {
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
            كود في كل سطر
          </label>
          <textarea
            id="codes"
            name="codes"
            className="input"
            rows={8}
            dir="auto"
          />
          <label className="label" htmlFor="codesFile">
            أو ارفع ملف txt
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
        {pending ? "لحظة…" : stockId ? "حذف" : "إضافة الأكواد"}
      </button>
      {state?.error && (
        <p role="alert" className="text-red-700">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="text-emerald-700">
          {state.message}
        </p>
      )}
    </form>
  );
}
