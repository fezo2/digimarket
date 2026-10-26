import { requireUser } from "@/lib/auth";
import { PasswordForm } from "@/components/password-form";

export const metadata = { title: "أمان الحساب" };

export default async function SecurityPage() {
  await requireUser("/account/security");
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">أمان الحساب</h1>
      <PasswordForm />
    </div>
  );
}
