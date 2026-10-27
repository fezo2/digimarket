import { i18n } from "@/lib/prefs";
import { requireUser } from "@/lib/auth";
import { PasswordForm } from "@/components/password-form";

export async function generateMetadata() {
  return { title: (await i18n()).t("أمان الحساب") };
}

export default async function SecurityPage() {
  const { t } = await i18n();
  await requireUser("/account/security");
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{t("أمان الحساب")}</h1>
      <PasswordForm />
    </div>
  );
}
