import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { forgotPassword } from "./actions";
export default function Page() {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) notFound();
  return (
    <section className="card mx-auto my-8 max-w-md p-6">
      <h1 className="text-xl font-bold">نسيت الباسورد</h1>
      <ActionForm action={forgotPassword} button="ابعت لينك">
        <label className="label">
          الإيميل
          <input className="input" type="email" name="email" required />
        </label>
      </ActionForm>
    </section>
  );
}
