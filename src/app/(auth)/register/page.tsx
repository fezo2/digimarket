import { safeRedirectPath } from "@/lib/sites";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { register } from "../actions";
import { currentSite } from "@/lib/auth";

export const metadata = { title: "حساب جديد" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const site = await currentSite();
  if (site === "admin") redirect("/login");
  return (
    <AuthForm
      mode="register"
      action={register}
      next={safeRedirectPath(next) ?? undefined}
      title={site === "seller" ? "افتح حساب تاجر" : undefined}
    />
  );
}
