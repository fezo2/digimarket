import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { login } from "../actions";

export const metadata = { title: "تسجيل الدخول" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <>
      <AuthForm mode="login" action={login} next={next} />
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
