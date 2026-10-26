"use client";
import { useActionState, useRef } from "react";
import { reviewProduct } from "./actions";

export function ReviewForm({ id }: { id: string }) {
  const decisionRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(reviewProduct, undefined);
  return (
    <form action={action} className="card space-y-4 p-6">
      <input
        ref={decisionRef}
        type="hidden"
        name="decision"
        defaultValue="ACTIVE"
      />
      <input type="hidden" name="id" value={id} />
      <label htmlFor="reviewNote" className="label">
        سبب الرفض (مطلوب لو هترفض)
      </label>
      <textarea
        id="reviewNote"
        name="reviewNote"
        className="input"
        maxLength={2000}
      />
      {state?.error && (
        <p role="alert" className="text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={() => {
            if (decisionRef.current) decisionRef.current.value = "ACTIVE";
          }}
          disabled={pending}
          className="btn-primary"
        >
          موافقة ونشر
        </button>
        <button
          onClick={() => {
            if (decisionRef.current) decisionRef.current.value = "REJECTED";
          }}
          disabled={pending}
          className="btn-danger"
        >
          رفض
        </button>
      </div>
    </form>
  );
}
