import Link from "next/link";
import { redirect } from "next/navigation";
import { i18n } from "@/lib/prefs";
import { readTwoFactorTicket } from "@/lib/two-factor";
import { TwoFactorLoginForm } from "./form";

export async function generateMetadata() {
  return { title: (await i18n()).t("التحقق بخطوتين") };
}

export default async function Page() {
  const { t } = await i18n();
  if (!(await readTwoFactorTicket())) redirect("/login");
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-12">
      <section className="card space-y-3 p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{t("التحقق بخطوتين")}</h1>
        <p className="text-sm text-slate-600">
          {t("افتح تطبيق المصادقة على موبايلك واكتب الكود اللي ظاهر لحساب ديجي مصر.")}
        </p>
        <TwoFactorLoginForm />
      </section>
      <p className="text-center text-sm">
        <Link href="/login" className="font-semibold text-brand-600">{t("رجوع لتسجيل الدخول")}</Link>
      </p>
    </div>
  );
}
