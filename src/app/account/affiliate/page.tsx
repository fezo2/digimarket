import Link from "next/link";
import { i18n } from "@/lib/prefs";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isVerified } from "@/lib/email-verification";
import { absolute } from "@/lib/seo";
import { formatBps } from "@/lib/money";
import { methodLabels, payoutLabels } from "@/lib/ledger";
import { payoutUnlockAt } from "@/lib/wallet-validation";
import { affiliateBalance, affiliateEntryLabels, affiliateSettings } from "@/lib/affiliate";
import { AFFILIATE_COOKIE_DAYS } from "@/lib/affiliate-rules";
import { ActionForm } from "@/components/action-form";
import { CopyField } from "@/components/copy-field";
import { askPayout, join, saveAccount } from "./actions";

export async function generateMetadata() {
  return { title: (await i18n()).t("برنامج الإحالة") };
}

export default async function AffiliatePage() {
  const { t, money, date, num } = await i18n();
  const user = await requireUser("/account/affiliate");
  const settings = await affiliateSettings();
  const affiliate = await db.affiliate.findUnique({ where: { userId: user.id } });

  if (!affiliate)
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-bold">{t("برنامج الإحالة")}</h1>
        <section className="card space-y-3 p-6">
          <p className="text-lg font-bold">{t("انشر لينكات المنتجات واكسب من كل بيعة")}</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
            <li>{t("بتاخد لحد {rate} من قيمة كل طلب يتم من لينكك.", { rate: formatBps(settings.rateBps) })}</li>
            <li>{t("الزيارة بتفضل محسوبة لك {days} يوم، حتى لو الشاري رجع اشترى بعدين.", { days: AFFILIATE_COOKIE_DAYS })}</li>
            <li>{t("الأرباح بتتاح للسحب بعد {days} أيام على الأقل من التسليم، ولو الطلب اترجع العمولة بتتلغي.", { days: settings.holdDays })}</li>
            <li>{t("مينفعش تكسب من شرايك لنفسك أو من منتجات متجرك.")}</li>
          </ul>
          {!settings.enabled ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{t("برنامج الإحالة متوقف دلوقتي، ارجع بعدين.")}</p>
          ) : !isVerified(user) ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {t("أكّد إيميلك الأول عشان تشترك.")}{" "}
              <Link href="/verify-email?next=/account/affiliate" className="font-semibold underline">{t("أكّد دلوقتي")}</Link>
            </p>
          ) : (
            <ActionForm action={join} button={t("اشترك في البرنامج")}>
              <label className="label">
                {t("كود الإحالة (اختياري، حروف إنجليزي وأرقام)")}
                <input className="input" name="code" dir="ltr" maxLength={24} placeholder="ahmed" />
              </label>
            </ActionForm>
          )}
        </section>
      </div>
    );

  const now = new Date();
  const [balance, orders, earned, entries, payouts] = await Promise.all([
    affiliateBalance(affiliate.id),
    db.order.count({ where: { affiliateId: affiliate.id, status: { in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] } } }),
    db.affiliateEntry.aggregate({
      where: { affiliateId: affiliate.id, type: { in: ["COMMISSION", "REVERSAL"] } },
      _sum: { amount: true },
    }),
    db.affiliateEntry.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { orderItem: { select: { title: true, total: true } } },
    }),
    db.affiliatePayout.findMany({ where: { affiliateId: affiliate.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const withdrawable = Math.max(0, balance.available - balance.frozen);
  const unlock = affiliate.payoutUpdatedAt ? payoutUnlockAt(affiliate.payoutUpdatedAt) : null;
  const home = absolute(`/?ref=${affiliate.code}`);
  const conversion = affiliate.clicks ? Math.round((orders / affiliate.clicks) * 1000) / 10 : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">{t("برنامج الإحالة")}</h1>
        <p className="text-sm text-slate-500">
          {t("كودك: ")}<span dir="ltr" className="font-mono font-bold">{affiliate.code}</span>
          {affiliate.rateBps !== null && <> · {t("نسبتك الخاصة: ")}{formatBps(affiliate.rateBps)}</>}
        </p>
      </div>
      {affiliate.suspendedAt && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {t("حساب الإحالة موقوف من الإدارة")}{affiliate.suspendReason ? `: ${affiliate.suspendReason}` : ""}
        </p>
      )}

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">{t("لينكاتك")}</h2>
        <p className="text-sm text-slate-600">
          {t("لينك الموقع كله، أو افتح أي منتج وهتلاقي لينكه الجاهز في خانة «شارك واكسب». تقدر كمان تضيف ده لآخر أي لينك من الموقع: ")}
          <code dir="ltr" className="font-mono font-bold">?ref={affiliate.code}</code>
        </p>
        <CopyField value={home} />
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("زيارات من لينكاتك")} value={num(affiliate.clicks)} />
        <Stat label={t("طلبات مدفوعة")} value={num(orders)} hint={t("تحويل {rate}%", { rate: num(conversion) })} />
        <Stat label={t("إجمالي الأرباح")} value={money(earned._sum.amount ?? 0)} />
        <Stat label={t("متاح للسحب")} value={money(withdrawable)} hint={t("معلّق: {held}", { held: money(balance.held + balance.frozen) })} />
      </div>

      <section className="card overflow-x-auto">
        <h2 className="p-4 font-bold">{t("آخر الحركات")}</h2>
        {entries.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-slate-500">{t("لسه مفيش أرباح. انشر لينكاتك وابدأ.")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {[t("التاريخ"), t("النوع"), t("التفاصيل"), t("المبلغ"), t("الحالة")].map((h) => (
                  <th key={h} className="p-3 text-start">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-50">
                  <td className="p-3">{date(e.createdAt)}</td>
                  <td className="p-3">{t(affiliateEntryLabels[e.type])}</td>
                  <td className="p-3">
                    {e.orderItem ? `${e.orderItem.title} · ${money(e.orderItem.total)}` : ""} {e.note ? `(${e.note})` : ""}
                  </td>
                  <td className={`p-3 font-semibold ${e.amount < 0 ? "text-red-700" : "text-emerald-700"}`} dir="ltr">
                    {money(e.amount)}
                  </td>
                  <td className="p-3">
                    {e.availableAt > now ? t("بيتاح {date}", { date: date(e.availableAt) }) : t("متاح")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card space-y-4 p-5">
          <h2 className="font-bold">{t("بيانات استلام الأرباح")}</h2>
          <p className="text-sm text-slate-600">{t("تغيير البيانات بيقفل السحب ٢٤ ساعة.")}</p>
          <ActionForm action={saveAccount} button={t("احفظ بيانات الحساب")}>
            <label className="label">
              {t("طريقة السحب")}
              <select className="input" name="method" defaultValue={affiliate.payoutMethod ?? "INSTAPAY"}>
                {Object.entries(methodLabels).map(([key, label]) => (
                  <option key={key} value={key}>{t(label)}</option>
                ))}
              </select>
            </label>
            <label className="label">
              {t("الحساب")}
              <input className="input" name="account" dir="ltr" required maxLength={100} defaultValue={affiliate.payoutAccount ?? ""} />
            </label>
            <p className="text-xs text-slate-500">
              {t("InstaPay: name@instapay أو موبايل مصري · المحفظة: موبايل مصري · البنك: EG وبعدها ٢٧ رقم.")}
            </p>
            <label className="label">
              {t("اسم صاحب الحساب")}
              <input className="input" name="holderName" required maxLength={150} defaultValue={affiliate.payoutHolderName ?? ""} />
            </label>
            <label className="label">
              {t("الباسورد الحالي")}
              <input className="input" name="password" type="password" autoComplete="current-password" required maxLength={200} />
            </label>
          </ActionForm>
        </section>
        <section className="card space-y-4 p-5">
          <h2 className="font-bold">{t("طلب سحب")}</h2>
          <p className="text-sm text-slate-600">
            {t("الحد الأدنى {min}. طلب واحد قيد المراجعة في المرة.", { min: money(settings.minPayout) })}
          </p>
          {unlock && unlock > now && <p role="status">{t("السحب هيتفتح: ")}{date(unlock)}</p>}
          <ActionForm action={askPayout} button={t("اطلب سحب")}>
            <label className="label">
              {t("المبلغ بالجنيه")}
              <input className="input" name="amount" inputMode="decimal" required maxLength={10} />
            </label>
          </ActionForm>
          {payouts.length > 0 && (
            <ul className="divide-y divide-slate-100 text-sm">
              {payouts.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{date(p.createdAt)} · {t(methodLabels[p.method])}</span>
                  <span className="font-semibold">{money(p.amount)} · {t(payoutLabels[p.status])}</span>
                  {(p.reference || p.rejectReason) && (
                    <span className="w-full text-xs text-slate-500">{p.reference ?? p.rejectReason}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
