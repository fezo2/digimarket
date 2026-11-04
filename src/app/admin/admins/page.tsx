import { i18n } from "@/lib/prefs";
import { requireFullAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { addStaff, removeStaff, staffDate } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await i18n()).t("حسابات الأدمن") };
}

// yyyy-mm-dd in Cairo time, for <input type="date">.
const ymd = (d: Date) =>
  new Date(d.getTime() + 2 * 3600000).toISOString().slice(0, 10);

export default async function Admins() {
  const { t, day } = await i18n();
  const me = await requireFullAdmin();
  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      adminDataFrom: true,
      suspendedAt: true,
    },
  });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t("حسابات الأدمن")}</h1>
      <p className="text-sm text-slate-500">
        {t("الأدمن المحدود عنده كل أدوات لوحة الأدمن، بس مش بيشوف أي طلبات أو تحويلات أو شكاوى أو رسائل أو حركات حصلت قبل تاريخ البداية بتاعه، ومايقدرش يضيف أدمن تاني.")}
      </p>

      <section className="card space-y-4 p-5">
        <h2 className="font-bold">{t("ضيف أدمن محدود")}</h2>
        <ActionForm action={addStaff} button={t("ضيف الأدمن")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="label">
              {t("الاسم")}
              <input className="input" name="name" required maxLength={100} />
            </label>
            <label className="label">
              {t("الإيميل")}
              <input className="input" name="email" type="email" dir="ltr" required />
            </label>
            <label className="label">
              {t("باسورد")}
              <input
                className="input"
                name="password"
                type="password"
                autoComplete="new-password"
                dir="ltr"
              />
              <span className="text-xs text-slate-500">
                {t("لو الإيميل ده عنده حساب على الموقع سيب الباسورد فاضي، هيدخل بالباسورد بتاعه.")}
              </span>
            </label>
            <label className="label">
              {t("يشوف البيانات من تاريخ")}
              <input className="input" name="dataFrom" type="date" dir="ltr" />
              <span className="text-xs text-slate-500">
                {t("لو سبته فاضي هيشوف اللي هيحصل من دلوقتي بس.")}
              </span>
            </label>
          </div>
        </ActionForm>
      </section>

      <section className="space-y-3">
        {admins.map((a) => (
          <div key={a.id} className="card space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{a.name}</span>
              <span className="text-sm text-slate-500" dir="ltr">
                {a.email}
              </span>
              <span className="badge">
                {a.adminDataFrom ? t("أدمن محدود") : t("أدمن كامل")}
              </span>
              {a.id === me.id && <span className="badge">{t("إنت")}</span>}
              {a.suspendedAt && <span className="badge">{t("موقوف")}</span>}
            </div>
            {a.adminDataFrom && (
              <>
                <p className="text-sm">
                  {t("بيشوف من: ")}
                  {day(a.adminDataFrom)}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ActionForm action={staffDate} button={t("غيّر التاريخ")}>
                    <input type="hidden" name="userId" value={a.id} />
                    <input
                      className="input"
                      name="dataFrom"
                      type="date"
                      dir="ltr"
                      defaultValue={ymd(a.adminDataFrom)}
                      required
                    />
                  </ActionForm>
                  <ActionForm action={removeStaff} button={t("شيل صلاحية الأدمن")}>
                    <input type="hidden" name="userId" value={a.id} />
                  </ActionForm>
                </div>
              </>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
