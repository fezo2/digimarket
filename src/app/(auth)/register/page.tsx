import { AuthForm } from "@/components/auth-form";
import { register } from "../actions";

export const metadata = { title: "حساب جديد" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthForm mode="register" action={register} next={next} />;
}
