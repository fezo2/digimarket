"use client";
import { useI18n } from "@/components/i18n-provider";
import { leaveStoreAction } from "../staff/actions";

export function LeaveStoreForm() {
  const { t } = useI18n();
  return (
    <form
      action={leaveStoreAction}
      onSubmit={(e) => {
        if (!confirm(t("متأكد إنك عاوز تسيب المتجر؟"))) e.preventDefault();
      }}
    >
      <button className="btn-danger">{t("سيب المتجر")}</button>
    </form>
  );
}
