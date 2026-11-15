import { i18n } from "@/lib/prefs";
import { requireAdmin } from "@/lib/auth";
import { PasswordForm } from "@/components/password-form";
import { TwoFactorSection } from "@/components/two-factor-section";

export async function generateMetadata() {
  return { title: (await i18n()).t("أمان حسابي") };
}

export default async function AdminSecurityPage() {
  const { t } = await i18n();
  const user = await requireAdmin();
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">{t("أمان حسابي")}</h1>
      <PasswordForm />
      <TwoFactorSection user={user} />
    </div>
  );
}
