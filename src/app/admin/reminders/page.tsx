import { i18n } from "@/lib/prefs";
import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { reminderSettings, reminderStats } from "@/lib/checkout-reminders";
import { MAX_DELAY_MINUTES, MIN_DELAY_MINUTES } from "@/lib/checkout-reminder-text";
import { saveReminders } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await i18n()).t("تذكير الدفع") };
}

export default async function RemindersPage() {
  const { t, num } = await i18n();
  await requireAdmin();
  const [settings, stats] = await Promise.all([reminderSettings(), reminderStats(7)]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t("تذكير الدفع")}</h1>
        <p className="text-sm text-slate-500">
          {t("لما مشتري يفتح طلب ومايدفعش، بنبعتله إيميل واحد فيه لينكات المنتجات (وكمان على تيليجرام لو رابطه). مرة واحدة في اليوم بالكتير لكل مشتري، وبس على الطلبات اللي عمرها أقل من يومين.")}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-sm text-slate-500">{t("تذكيرات اتبعتت آخر ٧ أيام")}</p>
          <p className="mt-1 text-2xl font-bold">{num(stats.sent)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">{t("رجعوا ودفعوا خلال ٣ أيام")}</p>
          <p className="mt-1 text-2xl font-bold">
            {num(stats.recovered)}
            {stats.sent > 0 && (
              <span className="ms-2 text-sm font-medium text-slate-500">
                ({num(Math.round((stats.recovered / stats.sent) * 100))}%)
              </span>
            )}
          </p>
        </div>
      </div>
      <section className="card space-y-3 p-5 text-sm">
        <h2 className="font-bold">{t("الإعدادات")}</h2>
        <ActionForm action={saveReminders} button={t("حفظ")}>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="enabled" defaultChecked={settings.enabled} />
            <span>{t("ابعت تذكيرات الدفع")}</span>
          </label>
          <label className="label">
            {t("ابعت التذكير بعد كام دقيقة من فتح الطلب")}
            <input
              className="input mt-1"
              type="number"
              name="delayMinutes"
              min={MIN_DELAY_MINUTES}
              max={MAX_DELAY_MINUTES}
              defaultValue={settings.delayMinutes}
              dir="ltr"
            />
          </label>
        </ActionForm>
        <p className="text-slate-500">
          {t("التذكيرات بتتبعت من مهمة الكرون checkout-reminders. لو مش متضافة في cron-job.org، مفيش حاجة هتتبعت.")}
        </p>
      </section>
    </div>
  );
}
