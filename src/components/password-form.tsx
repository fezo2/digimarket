import { ActionForm } from "./action-form";
import { updatePassword } from "@/app/(auth)/actions";

export function PasswordForm() {
  return (
    <section className="card space-y-3 p-6">
      <h2 className="text-lg font-bold">تغيير الباسورد</h2>
      <ActionForm action={updatePassword} button="غيّر الباسورد">
        <label className="label">
          الباسورد الحالي
          <input className="input" type="password" name="current" required autoComplete="current-password" dir="ltr" />
        </label>
        <label className="label">
          الباسورد الجديد
          <input className="input" type="password" name="next" required minLength={8} autoComplete="new-password" dir="ltr" />
        </label>
      </ActionForm>
    </section>
  );
}
