import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { i18n } from "@/lib/prefs";
import { adminFrom, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatBps } from "@/lib/money";
import { paginate } from "@/lib/pagination";
import { Pager } from "@/components/pager";
import { ActionForm } from "@/components/action-form";
import { affiliateSettings } from "@/lib/affiliate";
import { settings as saveSettings } from "./actions";

const PER_PAGE = 30;

export default async function AdminAffiliates({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { t, money, num, date } = await i18n();
  const admin = await requireAdmin();
  const { q = "", page } = await searchParams;
  const term = q.trim().slice(0, 100);
  const where: Prisma.AffiliateWhereInput = {
    createdAt: adminFrom(admin),
    ...(term
      ? {
          OR: [
            { code: { contains: term.toLowerCase() } },
            { user: { email: { contains: term, mode: "insensitive" } } },
            { user: { name: { contains: term, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [config, info, earned, requested] = await Promise.all([
    affiliateSettings(),
    db.affiliate.count({ where }).then((n) => paginate(n, PER_PAGE, page)),
    db.affiliateEntry.aggregate({
      where: { type: { in: ["COMMISSION", "REVERSAL"] }, createdAt: adminFrom(admin) },
      _sum: { amount: true },
    }),
    db.affiliatePayout.count({ where: { status: "REQUESTED", createdAt: adminFrom(admin) } }),
  ]);
  const affiliates = await db.affiliate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: info.skip,
    take: info.take,
    include: {
      user: { select: { email: true, name: true } },
      _count: { select: { orders: { where: { status: { in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] } } } } },
    },
  });
  const sums = new Map(
    (
      await db.affiliateEntry.groupBy({
        by: ["affiliateId"],
        where: { affiliateId: { in: affiliates.map((a) => a.id) }, type: { in: ["COMMISSION", "REVERSAL"] } },
        _sum: { amount: true },
      })
    ).map((r) => [r.affiliateId, r._sum.amount ?? 0]),
  );
  const full = !admin.adminDataFrom;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("برنامج الإحالة")}</h1>
        <Link href="/admin/affiliates/payouts" className="btn-outline">
          {t("طلبات سحب المسوّقين")} {requested > 0 && <span className="badge ms-1 bg-red-600 text-white">{num(requested)}</span>}
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-slate-500">{t("المسوّقين")}</p>
          <p className="text-xl font-extrabold">{num(info.total)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">{t("عمولات المسوّقين (صافي)")}</p>
          <p className="text-xl font-extrabold">{money(earned._sum.amount ?? 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">{t("الحالة")}</p>
          <p className={`text-xl font-extrabold ${config.enabled ? "text-emerald-700" : "text-red-700"}`}>
            {config.enabled ? t("شغّال") : t("متوقف")} · {formatBps(config.rateBps)}
          </p>
        </div>
      </div>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">{t("إعدادات البرنامج")}</h2>
        <p className="text-sm text-slate-600">
          {t("العمولة بتتحسب من إجمالي الطلب وبتطلع من عمولة المنصة (عمرها ما تزيد عنها)، فأرباح التاجر مش بتتأثر. تقدر تحدد نسبة لكل متجر من صفحته، ونسبة خاصة لكل مسوّق من صفحته.")}
        </p>
        {full ? (
          <ActionForm action={saveSettings} button={t("حفظ الإعدادات")}>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="enabled" defaultChecked={config.enabled} />
              {t("البرنامج شغّال (لو اتقفل، الطلبات الجديدة مش بتتحسب لحد)")}
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="label">
                {t("النسبة الافتراضية %")}
                <input className="input" name="rate" dir="ltr" required defaultValue={String(config.rateBps / 100)} />
              </label>
              <label className="label">
                {t("أقل مدة ضمان (أيام)")}
                <input className="input" name="holdDays" dir="ltr" required defaultValue={config.holdDays} />
              </label>
              <label className="label">
                {t("الحد الأدنى للسحب (جنيه)")}
                <input className="input" name="minPayout" dir="ltr" required defaultValue={config.minPayout / 100} />
              </label>
            </div>
          </ActionForm>
        ) : (
          <p className="text-sm">
            {t("النسبة {rate} · الضمان {days} أيام · الحد الأدنى للسحب {min}", {
              rate: formatBps(config.rateBps),
              days: config.holdDays,
              min: money(config.minPayout),
            })}
          </p>
        )}
      </section>

      <form className="flex gap-2">
        <input className="input max-w-sm" name="q" defaultValue={term} placeholder={t("ابحث بالكود أو الإيميل")} />
        <button className="btn-outline">{t("بحث")}</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {[t("الكود"), t("الحساب"), t("زيارات"), t("طلبات"), t("الأرباح"), t("النسبة"), t("الحالة"), t("انضم")].map((h) => (
                <th key={h} className="p-3 text-start">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {affiliates.map((a) => (
              <tr key={a.id} className="border-b border-slate-50">
                <td className="p-3 font-mono" dir="ltr">
                  <Link href={`/admin/affiliates/${a.id}`} className="font-semibold text-brand-600 underline">{a.code}</Link>
                </td>
                <td className="p-3">{a.user.name} · <span dir="ltr">{a.user.email}</span></td>
                <td className="p-3">{num(a.clicks)}</td>
                <td className="p-3">{num(a._count.orders)}</td>
                <td className="p-3">{money(sums.get(a.id) ?? 0)}</td>
                <td className="p-3">{a.rateBps === null ? t("افتراضي") : formatBps(a.rateBps)}</td>
                <td className="p-3">{a.suspendedAt ? <span className="text-red-700">{t("موقوف")}</span> : t("نشط")}</td>
                <td className="p-3">{date(a.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!affiliates.length && <p className="p-4 text-sm text-slate-500">{t("مفيش مسوّقين لسه.")}</p>}
      </div>
      <Pager {...info} params={{ q: term || undefined }} />
    </div>
  );
}
