"use client";
import { useI18n } from "@/components/i18n-provider";
import { useActionState } from "react";
import { telegramSettings } from "./actions";
export function TelegramForm({ linked }: { linked: boolean }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(telegramSettings, {});
  return (
    <form action={action} className="card mt-4 space-y-3 p-5">
      <p>{linked ? t("تليجرام مربوط") : t("اربط تليجرام عشان توصلك إشعارات")}</p>
      <button
        className="btn-primary"
        name="operation"
        value="link"
        disabled={pending}
      >
        {t("اربط تليجرام")}
      </button>
      <button
        className="btn-outline ms-3"
        name="operation"
        value="unlink"
        disabled={pending}
      >
        {t("إلغاء الربط")}
      </button>
      {state.link && (
        <a
          className="block underline"
          href={state.link}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("افتح البوت واضغط Start خلال ١٥ دقيقة")}
        </a>
      )}
      {state.error && <p role="alert">{t(state.error)}</p>}
      {state.success && <p>{t(state.success)}</p>}
    </form>
  );
}
