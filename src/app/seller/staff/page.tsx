import { i18n } from "@/lib/prefs";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { MAX_STAFF, STAFF_PERMISSIONS } from "@/lib/seller-staff";
import type { StaffPermission } from "@prisma/client";
import { addStaffAction, removeStaffAction, updateStaffAction } from "./actions";

export async function generateMetadata() {
  return { title: (await i18n()).t("الموظفين") };
}

async function PermissionBoxes({ checked = [] }: { checked?: StaffPermission[] }) {
  const { t } = await i18n();
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      {STAFF_PERMISSIONS.map((p) => (
        <label key={p.key} className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm">
          <input type="checkbox" name="permissions" value={p.key} defaultChecked={checked.includes(p.key)} className="mt-1" />
          <span>
            <span className="block font-semibold">{t(p.label)}</span>
            <span className="text-slate-500">{t(p.hint)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export default async function StaffPage() {
  const { t, date } = await i18n();
  const { seller } = await requireSeller();
  const staff = await db.sellerStaff.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true, twoFactorEnabledAt: true } } },
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">{t("الموظفين")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("اختياري: ضيف حد يساعدك في المتجر بحسابه الخاص، واختار هو يفتح إيه. السحب والتوثيق وإعدادات المتجر وقائمة الموظفين ليك انت بس.")}
        </p>
      </div>

      {staff.length < MAX_STAFF && (
        <section className="card space-y-3 p-6">
          <h2 className="text-lg font-bold">{t("ضيف موظف")}</h2>
          <ActionForm action={addStaffAction} button={t("إضافة")}>
            <label className="label">
              {t("إيميل الموظف")}
              <input className="input" type="email" name="email" required maxLength={254} dir="ltr" />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                {t("لازم يكون عامل حساب على ديجي مصر بالإيميل ده الأول.")}
              </span>
            </label>
            <PermissionBoxes checked={["ORDERS", "MESSAGES"]} />
          </ActionForm>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          {t("موظفينك")} ({staff.length}/{MAX_STAFF})
        </h2>
        {!staff.length && <p className="text-sm text-slate-500">{t("لسه مفيش موظفين.")}</p>}
        {staff.map((s) => (
          <article key={s.id} className="card space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold">{s.user.name}</p>
              <span className="text-sm text-slate-500" dir="ltr">{s.user.email}</span>
              {s.user.twoFactorEnabledAt && (
                <span className="badge bg-green-100 text-green-800">{t("التحقق بخطوتين مفعّل")}</span>
              )}
              <span className="ms-auto text-xs text-slate-500">{t("من {when}", { when: date(s.createdAt) })}</span>
            </div>
            <ActionForm action={updateStaffAction} button={t("حفظ الصلاحيات")}>
              <input type="hidden" name="id" value={s.id} />
              <PermissionBoxes checked={s.permissions} />
            </ActionForm>
            <ActionForm action={removeStaffAction} button={t("شيل الموظف")}>
              <input type="hidden" name="id" value={s.id} />
            </ActionForm>
          </article>
        ))}
      </section>
    </div>
  );
}
