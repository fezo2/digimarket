import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatBps } from "@/lib/money";
import { parsePeriod, withParams } from "@/lib/seller-period";
import { salesWhere, type SalesFilter } from "@/lib/seller-tools";
import { Select } from "../auto-select";
import { Icon } from "../icons";
import { Empty, Page, Pager, PageTitle, Panel, PeriodTabs, Pill, SearchBox } from "../ui";

export async function generateMetadata() {
  return { title: (await i18n()).t("الطلبات") };
}

const PER_PAGE = 20;
const FILTERS = ["q", "p", "from", "to", "product", "promo", "status", "delivery", "review"] as const;

export default async function SellerOrders({
  searchParams,
}: {
  searchParams: Promise<SalesFilter & { order?: string; page?: string }>;
}) {
  const { t, money, num, day, time } = await i18n();
  const query = await searchParams;
  const { seller } = await requireSeller();
  const filter = Object.fromEntries(FILTERS.map((k) => [k, query[k] || undefined])) as SalesFilter;
  const period = parsePeriod(filter, "all");
  const where = {
    ...salesWhere(seller.id, filter),
    ...(query.order ? { orderId: query.order } : {}),
  };
  const [products, coupons, total] = await Promise.all([
    db.product.findMany({ where: { sellerId: seller.id }, orderBy: { createdAt: "desc" }, select: { id: true, title: true } }),
    db.coupon.findMany({ where: { sellerId: seller.id }, orderBy: { code: "asc" }, select: { id: true, code: true } }),
    db.orderItem.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(query.page) || 1));
  const items = await db.orderItem.findMany({
    where,
    orderBy: { order: { paidAt: "desc" } },
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
    select: {
      id: true,
      productId: true,
      title: true,
      quantity: true,
      total: true,
      commissionBps: true,
      commissionAmount: true,
      sellerNet: true,
      deliveredAt: true,
      refundedAmount: true,
      review: { select: { positive: true } },
      ledger: { where: { type: "SALE" }, select: { availableAt: true }, take: 1 },
      order: {
        select: {
          id: true,
          number: true,
          status: true,
          paidAt: true,
          coupon: { select: { code: true } },
          buyer: { select: { email: true } },
        },
      },
    },
  });
  const params = { ...filter, order: query.order };
  const now = new Date();
  const filtered = FILTERS.some((k) => filter[k]) || query.order;
  const statusPill = {
    PAID: <Pill tone="blue">{t("مدفوع")}</Pill>,
    PARTIALLY_REFUNDED: <Pill tone="amber">{t("مسترد جزئياً")}</Pill>,
    REFUNDED: <Pill tone="red">{t("مسترد")}</Pill>,
  } as Record<string, React.ReactNode>;

  return (
    <Page>
      <PageTitle title={t("الطلبات")}>
        <a className="btn-outline" href={`/seller/sales/export${withParams(filter, {})}`}>
          <Icon name="download" className="size-4" />
          {t("تحميل Excel (CSV)")}
        </a>
      </PageTitle>
      <PeriodTabs period={period} params={params} keys={["all", "today", "yesterday", "7d", "30d"]} />
      <Panel className="space-y-5">
        <form className="flex flex-wrap gap-3">
          {(["p", "from", "to", "order"] as const).map((k) => params[k] && <input key={k} type="hidden" name={k} value={params[k]} />)}
          <Select
            name="product"
            label={t("المنتج")}
            value={filter.product}
            options={[{ value: "", label: t("كل المنتجات") }, ...products.map((p) => ({ value: p.id, label: p.title }))]}
          />
          <Select
            name="promo"
            label={t("كود الخصم")}
            value={filter.promo}
            options={[{ value: "", label: t("كل أكواد الخصم") }, ...coupons.map((c) => ({ value: c.id, label: c.code }))]}
          />
          <Select
            name="status"
            label={t("الحالة")}
            value={filter.status}
            options={[
              { value: "", label: t("كل الحالات") },
              { value: "paid", label: t("مدفوع") },
              { value: "partial", label: t("مسترد جزئياً") },
              { value: "refunded", label: t("مسترد") },
            ]}
          />
          <Select
            name="delivery"
            label={t("التسليم")}
            value={filter.delivery}
            options={[
              { value: "", label: t("كل حالات التسليم") },
              { value: "delivered", label: t("اتسلّم") },
              { value: "pending", label: t("مراجعة الإدارة") },
              { value: "refunded", label: t("مسترد") },
            ]}
          />
          <Select
            name="review"
            label={t("التقييم")}
            value={filter.review}
            options={[
              { value: "", label: t("كل التقييمات") },
              { value: "positive", label: t("إيجابي") },
              { value: "negative", label: t("سلبي") },
              { value: "none", label: t("من غير تقييم") },
            ]}
          />
          <SearchBox value={filter.q} placeholder={t("رقم الطلب أو إيميل المشتري أو المنتج أو الكود")} />
        </form>
        {items.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>{t("المنتج")}</th>
                  <th>{t("رقم الطلب")}</th>
                  <th>{t("التاريخ")}</th>
                  <th>{t("المشتري")}</th>
                  <th>{t("التقييم")}</th>
                  <th>{t("الحالة")}</th>
                  <th>{t("التسليم")}</th>
                  <th>{t("قيمة الطلب")}</th>
                  <th>{t("صافي ليك")}</th>
                  <th>{t("متاح للسحب")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const unlock = i.ledger[0]?.availableAt;
                  return (
                    <tr key={i.id} className="border-t">
                      <td className="max-w-72">
                        <Link dir="auto" className="block truncate font-medium underline-offset-4 hover:underline" href={`/seller/sales/${i.order.id}`}>
                          {i.title}
                        </Link>
                        {i.quantity > 1 && <span className="text-xs text-slate-500">× {num(i.quantity)}</span>}
                        {i.order.coupon && <span className="ms-2 text-xs text-slate-500">🏷 {i.order.coupon.code}</span>}
                      </td>
                      <td>
                        <Link className="font-semibold underline-offset-4 hover:underline" href={`/seller/sales/${i.order.id}`}>
                          #{i.order.number}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">{i.order.paidAt && `${day(i.order.paidAt)} ${time(i.order.paidAt)}`}</td>
                      <td dir="ltr" className="text-start">{i.order.buyer.email}</td>
                      <td>{i.review ? (i.review.positive ? "👍" : "👎") : <span className="text-slate-400">{t("لا")}</span>}</td>
                      <td>{statusPill[i.order.status]}</td>
                      <td>
                        {i.refundedAmount > 0 ? (
                          <Pill tone="amber">{t("مسترد {amount}", { amount: money(i.refundedAmount) })}</Pill>
                        ) : i.deliveredAt ? (
                          <Pill tone="green">{t("اتسلّم")}</Pill>
                        ) : (
                          <Pill tone="grey">{t("مراجعة الإدارة")}</Pill>
                        )}
                      </td>
                      <td className="whitespace-nowrap">{money(i.total)}</td>
                      <td className="whitespace-nowrap font-semibold" title={t("العمولة {amount} ({rate})", { amount: money(i.commissionAmount), rate: formatBps(i.commissionBps) })}>
                        {money(i.sellerNet)}
                      </td>
                      <td className="whitespace-nowrap text-slate-500">
                        {!unlock ? "—" : unlock > now ? t("من {date}", { date: day(unlock) }) : t("متاح")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="orders" title={filtered ? t("مفيش نتايج") : t("لسه مفيش مبيعات.")} />
        )}
        <Pager page={page} pages={pages} params={params} />
      </Panel>
    </Page>
  );
}
