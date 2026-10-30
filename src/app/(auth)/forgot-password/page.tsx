import { i18n } from "@/lib/prefs";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { forgotPassword } from "./actions";
export default async function Page() {
  const { t } = await i18n();
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) notFound();
  return (
    <section className="card mx-auto my-8 max-w-md p-6">
      <h1 className="text-xl font-bold">{t("نسيت الباسورد")}</h1>
      <ActionForm action={forgotPassword} button={t("ابعت لينك")} captcha>
        <label className="label">
          {t("الإيميل")}
          <input className="input" type="email" name="email" required />
        </label>
      </ActionForm>
    </section>
  );
}
