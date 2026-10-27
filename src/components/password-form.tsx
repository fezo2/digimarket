import { i18n } from "@/lib/prefs";
import { ActionForm } from "./action-form";
import { updatePassword } from "@/app/(auth)/actions";

export async function PasswordForm() {
  const { t } = await i18n();
  return (
    <section className="card space-y-3 p-6">
      <h2 className="text-lg font-bold">{t("تغيير الباسورد")}</h2>
      <ActionForm action={updatePassword} button={t("غيّر الباسورد")}>
        <label className="label">
          {t("الباسورد الحالي")}
          <input className="input" type="password" name="current" required autoComplete="current-password" dir="ltr" />
        </label>
        <label className="label">
          {t("الباسورد الجديد")}
          <input className="input" type="password" name="next" required minLength={8} autoComplete="new-password" dir="ltr" />
        </label>
      </ActionForm>
    </section>
  );
}
