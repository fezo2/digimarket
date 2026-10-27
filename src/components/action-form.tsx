"use client";
import { useI18n } from "@/components/i18n-provider";
import { prepareUploads } from "@/lib/upload-form";
import { useActionState } from "react";
import type { UploadKind } from "@/lib/storage-rules";
export type ActionState = { error?: string; success?: string };
export function ActionForm({
  action,
  children,
  button,
  uploadOrderId,
  uploadKind = "chat",
  uploadFields = ["image"],
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  button: string;
  uploadOrderId?: string;
  uploadKind?: UploadKind;
  uploadFields?: string[];
}) {
  const { t } = useI18n();
  const [state, submit, pending] = useActionState(
    async (state: ActionState, form: FormData) => {
      if (uploadOrderId) {
        try {
          await prepareUploads(form, uploadKind, uploadFields, uploadOrderId);
        } catch {
          return { error: t("رفع الصورة فشل، جرّب تاني") };
        }
      }
      return action(state, form);
    },
    {},
  );
  return (
    <form action={submit} className="space-y-3">
      {children}
      {state.error && (
        <p role="alert" className="text-red-700">
          {t(state.error)}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-green-700">
          {t(state.success)}
        </p>
      )}
      <button className="btn-primary" disabled={pending}>
        {pending ? t("جاري التنفيذ…") : button}
      </button>
    </form>
  );
}
