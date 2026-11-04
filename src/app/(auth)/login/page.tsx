import { i18n } from "@/lib/prefs";
import { safeRedirectPath } from "@/lib/sites";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { login } from "../actions";
import { currentSite } from "@/lib/auth";
import { enabledProviders } from "@/lib/oauth";

// Shown when a Google or Apple sign in comes back without a session.
const OAUTH_ERRORS: Record<string, string> = {
  cancelled: "تسجيل الدخول اتلغى",
  expired: "تسجيل الدخول خد وقت طويل، جرّب تاني",
  failed: "معرفناش نكمّل تسجيل الدخول، جرّب تاني",
  "no-email": "لازم تشارك إيميلك علشان نعرف حسابك",
  suspended: "حسابك موقوف من الإدارة. كلّم الدعم.",
};

const TITLES = {
  store: "تسجيل الدخول",
  seller: "دخول التجار",
  admin: "دخول الإدارة",
} as const;

export async function generateMetadata() {
  return { title: (await i18n()).t("تسجيل الدخول") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; oauth?: string }>;
}) {
  const { t } = await i18n();
  const { next, oauth } = await searchParams;
  const site = await currentSite();
  return (
    <>
      <AuthForm
        mode="login"
        action={login}
        next={safeRedirectPath(next) ?? undefined}
        title={t(TITLES[site])}
        allowSignup={site !== "admin"}
        providers={site === "admin" ? [] : enabledProviders()}
        notice={oauth ? OAUTH_ERRORS[oauth] : undefined}
      />
      {process.env.RESEND_API_KEY && process.env.EMAIL_FROM && (
        <p className="text-center">
          <Link className="underline" href="/forgot-password">
            {t("نسيت الباسورد")}
          </Link>
        </p>
      )}
    </>
  );
}
