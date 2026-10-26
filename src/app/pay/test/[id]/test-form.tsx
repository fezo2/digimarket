"use client";
import { useActionState, useRef } from "react";
import { testPayment } from "./actions";
export function TestForm({ id }: { id: string }) {
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
          دفع ناجح
        </button>
        <button
          disabled={pending}
          className="btn-danger"
          onClick={() => {
            if (decision.current) decision.current.value = "failure";
          }}
        >
          دفع فاشل
        </button>
      </div>
      {state?.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
