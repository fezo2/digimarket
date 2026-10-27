import { i18n } from "@/lib/prefs";
import { ActionForm } from "@/components/action-form";
import { applyReset } from "../forgot-password/actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { t } = await i18n();
  const { token } = await searchParams;
  return (
    <section className="card mx-auto my-8 max-w-md p-6">
      <h1 className="text-xl font-bold">{t("باسورد جديد")}</h1>
      <ActionForm action={applyReset} button={t("غيّر الباسورد")}>
        <input type="hidden" name="token" value={token || ""} />
        <label className="label">
          {t("الباسورد الجديد")}
          <input
            className="input"
            type="password"
            name="password"
            minLength={8}
            maxLength={200}
            required
          />
        </label>
      </ActionForm>
    </section>
  );
}
