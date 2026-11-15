import { i18n } from "@/lib/prefs";
import { TwoFactorSettings } from "./two-factor-settings";

// Optional two-step sign in, the same on the store, seller and admin sites.
export async function TwoFactorSection({
  user,
}: {
  user: { twoFactorEnabledAt: Date | null; twoFactorBackupCodes: string[] };
}) {
  const { t, date } = await i18n();
  return (
    <section className="card space-y-3 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">{t("التحقق بخطوتين")}</h2>
        <span className={user.twoFactorEnabledAt ? "badge bg-green-100 text-green-800" : "badge bg-slate-100 text-slate-600"}>
          {user.twoFactorEnabledAt ? t("مفعّل") : t("مش مفعّل")}
        </span>
      </div>
      <p className="text-sm text-slate-500">
        {t("اختياري: بعد الباسورد أو جوجل/أبل هنطلب كود من تطبيق مصادقة على موبايلك، فلو حد عرف الباسورد مش هيقدر يدخل. شغال على المتجر ولوحة التاجر والإدارة.")}
      </p>
      {user.twoFactorEnabledAt && (
        <p className="text-sm text-slate-600">
          {t("اتفعّل {when}، وفاضل معاك {n} كود احتياطي.", {
            when: date(user.twoFactorEnabledAt),
            n: String(user.twoFactorBackupCodes.length),
          })}
        </p>
      )}
      <TwoFactorSettings enabled={Boolean(user.twoFactorEnabledAt)} />
    </section>
  );
}
