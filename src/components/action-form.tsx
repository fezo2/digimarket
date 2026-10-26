"use client";
import { useActionState } from "react";
export type ActionState = { error?: string; success?: string };
export function ActionForm({
  action,
  children,
  button,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  button: string;
}) {
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className="space-y-3">
      {children}
      {state.error && (
        <p role="alert" className="text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-green-700">
          {state.success}
        </p>
      )}
      <button className="btn-primary" disabled={pending}>
        {pending ? "جاري التنفيذ…" : button}
      </button>
    </form>
  );
}
