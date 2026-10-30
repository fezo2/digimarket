import { redirect } from "next/navigation";
import { i18n } from "@/lib/prefs";
import { ActionForm } from "@/components/action-form";
import { currentSite, getCurrentUser } from "@/lib/auth";
import { isVerified } from "@/lib/email-verification";
import { SITE_HOME, safeRedirectPath } from "@/lib/sites";
import { confirmEmail, resendVerification } from "./actions";

export async function generateMetadata() {
  return { title: (await i18n()).t("تأكيد الإيميل") };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; next?: string }>;
}) {
  const { t } = await i18n();
  const { token, next: rawNext } = await searchParams;
  const next = safeRedirectPath(rawNext) ?? SITE_HOME[await currentSite()];

  if (token)
    return (
      <section className="card mx-auto my-8 max-w-md space-y-3 p-6">
        <h1 className="text-xl font-bold">{t("تأكيد الإيميل")}</h1>
        <p className="text-sm text-slate-600">{t("دوس على الزرار عشان تأكد إيميلك.")}</p>
        <ActionForm action={confirmEmail} button={t("أكّد الإيميل")}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="next" value={next} />
        </ActionForm>
      </section>
    );

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/verify-email")}`);
  if (isVerified(user)) redirect(next);
  return (
    <section className="card mx-auto my-8 max-w-md space-y-3 p-6">
      <h1 className="text-xl font-bold">{t("أكّد إيميلك")}</h1>
      <p className="text-sm text-slate-600">
        {t("بعتنا لينك التأكيد على")} <span dir="ltr" className="font-semibold">{user.email}</span>.{" "}
        {t("افتحه عشان تقدر تشتري أو تفتح متجر. اللينك شغال ٢٤ ساعة.")}
      </p>
      <p className="text-xs text-slate-500">{t("ماوصلكش؟ بص في فولدر الـ Spam أو اطلب لينك جديد.")}</p>
      <ActionForm action={resendVerification} button={t("ابعت لينك جديد")} />
    </section>
  );
}
