import { safeRedirectPath } from "@/lib/sites";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { login } from "../actions";
import { currentSite } from "@/lib/auth";

const TITLES = {
  store: "تسجيل الدخول",
  seller: "دخول التجار",
  admin: "دخول الإدارة",
} as const;

export const metadata = { title: "تسجيل الدخول" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const site = await currentSite();
  return (
    <>
      <AuthForm
        mode="login"
        action={login}
        next={safeRedirectPath(next) ?? undefined}
        title={TITLES[site]}
        allowSignup={site !== "admin"}
      />
      {process.env.RESEND_API_KEY && process.env.EMAIL_FROM && (
        <p className="text-center">
          <Link className="underline" href="/forgot-password">
            نسيت الباسورد
          </Link>
        </p>
      )}
    </>
  );
}
