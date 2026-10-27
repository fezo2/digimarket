import Link from "next/link";
import { i18n } from "@/lib/prefs";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_PROMO_CODES } from "@/lib/promo-codes";
import { Icon } from "../icons";
import { Empty, Page, PageTitle, Panel, Pill } from "../ui";
import { NewPromoForm, PromoButton } from "./promo-forms";

export async function generateMetadata() {
  return { title: (await i18n()).t("أكواد الخصم") };
}

// Seller promo codes. Checkout already accepts them (src/lib/orders.ts
// applyCoupon) and only for this seller's products.
export default async function PromoCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const { t, money, num, day } = await i18n();
  const { seller } = await requireSeller();
  const adding = (await searchParams).new === "1";
  const [codes, sales] = await Promise.all([
    db.coupon.findMany({ where: { sellerId: seller.id }, orderBy: [{ active: "desc" }, { code: "asc" }] }),
    db.order.groupBy({
      by: ["couponId"],
      where: { coupon: { sellerId: seller.id }, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
      _sum: { total: true, discount: true },
    }),
  ]);
  const totals = new Map(sales.map((s) => [s.couponId, s._sum]));
  const now = new Date();

  if (!codes.length && !adding)
    return (
      <Page>
        <Panel>
          <Empty icon="promo" title={t("معندكش أكواد خصم")} text={t("اعمل كود خصم وابعته لعملائك أو انشره على صفحاتك.")}>
            <Link href="?new=1" className="btn-primary">
              <Icon name="plus" className="size-4" />
              {t("إنشاء كود خصم")}
            </Link>
          </Empty>
        </Panel>
      </Page>
    );

  return (
    <Page>
      <PageTitle title={t("أكواد الخصم")}>
        {!adding && codes.length < MAX_PROMO_CODES && (
          <Link href="?new=1" className="btn-primary">
            <Icon name="plus" className="size-4" />
            {t("إنشاء كود خصم")}
          </Link>
        )}
      </PageTitle>
      {adding && (
        <Panel className="space-y-4">
          <div className="flex items-center">
            <h2 className="me-auto text-lg font-bold">{t("كود خصم جديد")}</h2>
            <Link href="/seller/promo-codes" className="text-sm text-slate-500 hover:text-slate-900">{t("إغلاق")}</Link>
          </div>
          <p className="text-sm text-slate-500">
            {t("الخصم بيتخصم من سعرك انت، والعمولة بتتحسب على السعر بعد الخصم. الكود بيشتغل على منتجاتك بس.")}
          </p>
          <NewPromoForm />
        </Panel>
      )}
      {codes.length > 0 && (
        <Panel>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>{t("الكود")}</th>
                  <th>{t("الخصم")}</th>
                  <th>{t("أقل طلب")}</th>
                  <th>{t("الاستخدام")}</th>
                  <th>{t("ينتهي")}</th>
                  <th>{t("مبيعات بالكود")}</th>
                  <th>{t("الحالة")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => {
                  const expired = !!c.expiresAt && c.expiresAt <= now;
                  const usedUp = c.usageLimit !== null && c.usedCount >= c.usageLimit;
                  const sum = totals.get(c.id);
                  return (
                    <tr key={c.id} className="border-t">
                      <td className="font-mono font-bold" dir="ltr">{c.code}</td>
                      <td className="whitespace-nowrap">{c.percentOff !== null ? `${num(c.percentOff)}%` : money(c.amountOff ?? 0)}</td>
                      <td className="whitespace-nowrap">{c.minTotal ? money(c.minTotal) : "—"}</td>
                      <td className="whitespace-nowrap">
                        {num(c.usedCount)}
                        {c.usageLimit !== null && <span className="text-slate-400"> / {num(c.usageLimit)}</span>}
                      </td>
                      <td className="whitespace-nowrap">{c.expiresAt ? day(new Date(c.expiresAt.getTime() - 1)) : t("مفتوح")}</td>
                      <td className="whitespace-nowrap">
                        {sum?.total ? (
                          <Link className="underline-offset-4 hover:underline" href={`/seller/sales?promo=${c.id}`}>
                            {money(sum.total)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {!c.active ? (
                          <Pill tone="grey">{t("موقوف")}</Pill>
                        ) : expired ? (
                          <Pill tone="amber">{t("انتهى")}</Pill>
                        ) : usedUp ? (
                          <Pill tone="amber">{t("خلص")}</Pill>
                        ) : (
                          <Pill tone="green">{t("شغّال")}</Pill>
                        )}
                      </td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <PromoButton
                            id={c.id}
                            operation={c.active ? "off" : "on"}
                            label={c.active ? t("إيقاف") : t("تشغيل")}
                            className="btn-outline px-3 py-1.5"
                          />
                          {!c.usedCount && (
                            <PromoButton id={c.id} operation="delete" label={t("حذف")} className="btn px-3 py-1.5 text-red-600 hover:bg-red-50" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </Page>
  );
}
