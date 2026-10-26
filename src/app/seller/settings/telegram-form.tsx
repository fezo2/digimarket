"use client";
import { useActionState } from "react";
import { telegramSettings } from "./actions";
export function TelegramForm({ linked }: { linked: boolean }) {
  const [state, action, pending] = useActionState(telegramSettings, {});
  return (
    <form action={action} className="card mt-4 space-y-3 p-5">
      <p>{linked ? "تليجرام مربوط" : "اربط تليجرام عشان توصلك إشعارات"}</p>
      <button
        className="btn-primary"
        name="operation"
        value="link"
        disabled={pending}
      >
        اربط تليجرام
      </button>
      <button
        className="btn-outline ms-3"
        name="operation"
        value="unlink"
        disabled={pending}
      >
        إلغاء الربط
      </button>
      {state.link && (
        <a
          className="block underline"
          href={state.link}
          target="_blank"
          rel="noopener noreferrer"
        >
          افتح البوت واضغط Start خلال ١٥ دقيقة
        </a>
      )}
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p>{state.success}</p>}
    </form>
  );
}
