import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { i18n } from "@/lib/prefs";
import { ActionForm } from "@/components/action-form";
import { pendingSignup } from "@/lib/signup";
import { SIGNUP_COOKIE } from "@/lib/sites";
import { confirmSignupCode, resendSignup } from "../../actions";

export async function generateMetadata() {
  return { title: (await i18n()).t("تأكيد الإيميل") };
}

export default async function Page() {
  const { t } = await i18n();
  const pending = await pendingSignup((await cookies()).get(SIGNUP_COOKIE)?.value);
  if (!pending) redirect("/register");
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-12">
      <section className="card space-y-3 p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{t("أكّد إيميلك")}</h1>
        <p className="text-sm text-slate-600">
          {t("بعتنا كود من ٦ أرقام على")} <span dir="ltr" className="font-semibold">{pending.email}</span>.{" "}
          {t("اكتبه هنا عشان نعمل حسابك. الكود شغال ١٥ دقيقة.")}
        </p>
        <ActionForm action={confirmSignupCode} button={t("تأكيد وإنشاء الحساب")}>
          <label className="label" htmlFor="code">{t("الكود")}</label>
          <input
            id="code"
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            dir="ltr"
            className="input text-center text-2xl tracking-[0.5em]"
            autoFocus
          />
        </ActionForm>
      </section>
      <section className="card space-y-2 p-6 text-sm">
        <p className="text-slate-600">{t("ماوصلكش؟ بص في فولدر الـ Spam أو اطلب كود جديد.")}</p>
        <ActionForm action={resendSignup} button={t("ابعت كود جديد")} />
        <Link href="/register" className="block font-semibold text-brand-600">{t("غيّر الإيميل")}</Link>
      </section>
    </div>
  );
}
