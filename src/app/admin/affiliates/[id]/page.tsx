import Link from "next/link";
import { notFound } from "next/navigation";
import { i18n } from "@/lib/prefs";
import { hiddenFromAdmin, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatBps } from "@/lib/money";
import { methodLabels } from "@/lib/ledger";
import { orderStatusLabels } from "@/lib/order-snapshot";
import { ActionForm } from "@/components/action-form";
import { affiliateBalance, affiliateEntryLabels, affiliateSettings } from "@/lib/affiliate";
import { cancelCommission, rate, suspension } from "../actions";

export default async function AdminAffiliate({ params }: { params: Promise<{ id: string }> }) {
  const { t, money, date, num } = await i18n();
  const admin = await requireAdmin();
  const { id } = await params;
  const affiliate = await db.affiliate.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true, suspendedAt: true } } },
  });
  if (!affiliate || hiddenFromAdmin(admin, affiliate.createdAt)) notFound();
  const [balance, config, entries, orders] = await Promise.all([
    affiliateBalance(affiliate.id),
    affiliateSettings(),
    db.affiliateEntry.findMany({
      where: { affiliateId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        orderItem: {
          select: {
            title: true,
            total: true,
            order: { select: { id: true, number: true, buyerIp: true, buyer: { select: { email: true } } } },
            affiliateEntries: { where: { type: "REVERSAL" }, select: { id: true } },
          },
        },
      },
    }),
    db.order.findMany({
      where: { affiliateId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, number: true, status: true, total: true, createdAt: true, buyerIp: true, buyer: { select: { email: true } } },
    }),
  ]);
  // Fraud hint: many referred orders from one buyer or one IP.
  const ipCounts = new Map<string, number>();
  for (const o of orders) if (o.buyerIp) ipCounts.set(o.buyerIp, (ipCounts.get(o.buyerIp) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <Link href="/admin/affiliates" className="text-sm text-brand-600">← {t("برنامج الإحالة")}</Link>
      <div>
        <h1 className="text-2xl font-bold" dir="ltr">{affiliate.code}</h1>
        <p className="text-sm text-slate-600">
          <Link href={`/admin/users/${affiliate.user.id}`} className="underline">{affiliate.user.name}</Link> · <span dir="ltr">{affiliate.user.email}</span>
          {" · "}{t("انضم ")}{date(affiliate.createdAt)}
        </p>
        {affiliate.suspendedAt && (
          <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {t("موقوف: ")}{affiliate.suspendReason}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-slate-500">{t("زيارات")}</p><p className="text-xl font-extrabold">{num(affiliate.clicks)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">{t("متاح")}</p><p className="text-xl font-extrabold">{money(balance.available - balance.frozen)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">{t("معلّق")}</p><p className="text-xl font-extrabold">{money(balance.held + balance.frozen)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">{t("حساب السحب")}</p><p className="text-sm font-bold">{affiliate.payoutMethod ? `${t(methodLabels[affiliate.payoutMethod])} · ${affiliate.payoutHolderName}` : t("مش متسجل")}</p></div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">{t("نسبة خاصة")}</h2>
          <ActionForm action={rate} button={t("حفظ النسبة")}>
            <input type="hidden" name="id" value={id} />
            <label className="label">
              {t("النسبة % (فاضي = نسبة المتجر أو الافتراضية {rate})", { rate: formatBps(config.rateBps) })}
              <input className="input" name="rate" dir="ltr" defaultValue={affiliate.rateBps === null ? "" : String(affiliate.rateBps / 100)} />
            </label>
          </ActionForm>
          <p className="text-xs text-slate-500">{t("متجر نسبته 0 بيفضل مقفول حتى مع النسبة الخاصة، والعمولة عمرها ما تزيد عن عمولة المنصة.")}</p>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">{affiliate.suspendedAt ? t("رفع الإيقاف") : t("إيقاف المسوّق")}</h2>
          {affiliate.suspendedAt ? (
            <ActionForm action={suspension} button={t("رفع الإيقاف")}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="suspend" value="false" />
            </ActionForm>
          ) : (
            <ActionForm action={suspension} button={t("إيقاف")}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="suspend" value="true" />
              <label className="label">
                {t("السبب (بيظهر للمسوّق)")}
                <textarea className="input" name="reason" required maxLength={500} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="reverse" />
                {t("إلغاء كل العمولات اللي لسه معلّقة (في حالة غش)")}
              </label>
            </ActionForm>
          )}
          <p className="text-xs text-slate-500">{t("الإيقاف بيمنع أي عمولة جديدة وأي طلب سحب.")}</p>
        </section>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="p-4 font-bold">{t("الحركات")}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {[t("التاريخ"), t("النوع"), t("الطلب"), t("المبلغ"), t("يتاح"), ""].map((h, i) => (
                <th key={i} className="p-3 text-start">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 align-top">
                <td className="p-3">{date(e.createdAt)}</td>
                <td className="p-3">{t(affiliateEntryLabels[e.type])}</td>
                <td className="p-3">
                  {e.orderItem ? (
                    <>
                      <Link href={`/admin/orders/${e.orderItem.order.id}`} className="underline">#{e.orderItem.order.number}</Link>{" "}
                      {e.orderItem.title} · <span dir="ltr">{e.orderItem.order.buyer.email}</span>
                    </>
                  ) : (
                    e.note
                  )}
                </td>
                <td className="p-3" dir="ltr">{money(e.amount)}</td>
                <td className="p-3">{date(e.availableAt)}</td>
                <td className="p-3">
                  {e.type === "COMMISSION" && e.orderItem && e.orderItem.affiliateEntries.length === 0 && (
                    <details>
                      <summary className="cursor-pointer text-red-700">{t("إلغاء العمولة")}</summary>
                      <ActionForm action={cancelCommission} button={t("تأكيد الإلغاء")}>
                        <input type="hidden" name="entryId" value={e.id} />
                        <input className="input" name="reason" required maxLength={500} placeholder={t("السبب")} />
                      </ActionForm>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!entries.length && <p className="p-4 text-sm text-slate-500">{t("مفيش حركات.")}</p>}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="p-4 font-bold">{t("طلبات جت من لينكاته")}</h2>
        <table className="w-full text-sm">
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-50">
                <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="underline">#{o.number}</Link></td>
                <td className="p-3">{date(o.createdAt)}</td>
                <td className="p-3" dir="ltr">{o.buyer.email}</td>
                <td className={`p-3 ${o.buyerIp && (ipCounts.get(o.buyerIp) ?? 0) > 2 ? "font-bold text-red-700" : ""}`} dir="ltr">{o.buyerIp ?? ""}</td>
                <td className="p-3">{t(orderStatusLabels[o.status])}</td>
                <td className="p-3">{money(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && <p className="p-4 text-sm text-slate-500">{t("مفيش طلبات لسه.")}</p>}
        {orders.length > 0 && <p className="p-4 text-xs text-slate-500">{t("الـ IP اللي باللون الأحمر اتكرر في أكتر من طلبين، راجعه.")}</p>}
      </section>
    </div>
  );
}
