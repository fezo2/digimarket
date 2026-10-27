import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { sellerBalance } from "@/lib/ledger";
import { SELLER_TIERS } from "@/lib/config";
import { parsePeriod, percentChange, periodSlots, withParams } from "@/lib/seller-period";
import { Select } from "./auto-select";
import { Change, Kpi, Page, Panel, PeriodTabs, Pill } from "./ui";

export async function generateMetadata() {
  return { title: (await i18n()).t("لوحة التاجر") };
}

const KYC_BANNER = {
  NOT_SUBMITTED: { cls: "bg-amber-50 text-amber-800", text: "لازم توثّق هويتك قبل ما منتجاتك تظهر للناس.", cta: true },
  PENDING: { cls: "bg-blue-50 text-blue-800", text: "طلب التوثيق قيد المراجعة. هنبلّغك أول ما يخلص.", cta: false },
  REJECTED: { cls: "bg-red-50 text-red-800", text: "طلب التوثيق اترفض. شوف السبب وابعت الطلب تاني.", cta: true },
  APPROVED: null,
} as const;

const METRICS = {
  gross: "قيمة المبيعات",
  net: "صافي أرباحك",
  orders: "عدد الطلبات",
} as const;
type Metric = keyof typeof METRICS;

type Totals = { gross: number; net: number; orders: number; units: number };

export default async function SellerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; from?: string; to?: string; product?: string; m?: string }>;
}) {
  const { t, money, num, day, lang } = await i18n();
  const { seller } = await requireSeller();
  const query = await searchParams;
  const period = parsePeriod(query, "30d");
  const metric: Metric = query.m && query.m in METRICS ? (query.m as Metric) : "gross";
  const products = await db.product.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });
  const product = products.some((p) => p.id === query.product) ? query.product! : "";
  const fmt = period.bucket === "month" ? "YYYY-MM" : "YYYY-MM-DD";

  const totals = async (from: Date | null, to: Date | null) => {
    const [row] = await db.$queryRaw<{ gross: bigint | null; net: bigint | null; orders: bigint; units: bigint | null }[]>`
      SELECT SUM(i.total - i."refundedAmount")::bigint AS gross, SUM(i."sellerNet")::bigint AS net,
        COUNT(DISTINCT o.id)::bigint AS orders, SUM(i.quantity)::bigint AS units
      FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
      WHERE i."sellerId" = ${seller.id} AND o.status IN ('PAID', 'PARTIALLY_REFUNDED')
        AND o."paidAt" >= ${from ?? new Date(0)} AND o."paidAt" < ${to ?? new Date()}
        AND (${product} = '' OR i."productId" = ${product})`;
    return {
      gross: Number(row?.gross ?? 0),
      net: Number(row?.net ?? 0),
      orders: Number(row?.orders ?? 0),
      units: Number(row?.units ?? 0),
    } satisfies Totals;
  };

  const [balance, now, before, series, top, recent, first, news, refunds] = await Promise.all([
    sellerBalance(seller.id),
    totals(period.from, period.to),
    period.prevFrom ? totals(period.prevFrom, period.prevTo) : null,
    db.$queryRaw<{ k: string; gross: bigint; net: bigint; orders: bigint }[]>`
      SELECT to_char((o."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Cairo', ${fmt}) AS k,
        SUM(i.total - i."refundedAmount")::bigint AS gross, SUM(i."sellerNet")::bigint AS net,
        COUNT(DISTINCT o.id)::bigint AS orders
      FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
      WHERE i."sellerId" = ${seller.id} AND o.status IN ('PAID', 'PARTIALLY_REFUNDED')
        AND o."paidAt" >= ${period.from ?? new Date(0)} AND o."paidAt" < ${period.to}
        AND (${product} = '' OR i."productId" = ${product})
      GROUP BY 1`,
    db.orderItem.groupBy({
      by: ["productId", "title"],
      where: {
        sellerId: seller.id,
        ...(product ? { productId: product } : {}),
        order: {
          status: { in: ["PAID", "PARTIALLY_REFUNDED"] },
          paidAt: { gte: period.from ?? undefined, lt: period.to },
        },
      },
      _sum: { quantity: true, sellerNet: true },
      orderBy: { _sum: { sellerNet: "desc" } },
      take: 5,
    }),
    db.orderItem.findMany({
      where: {
        sellerId: seller.id,
        order: { status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } },
      },
      orderBy: { order: { paidAt: "desc" } },
      take: 6,
      select: {
        id: true,
        title: true,
        total: true,
        deliveredAt: true,
        refundedAmount: true,
        order: { select: { id: true, number: true, paidAt: true, buyer: { select: { email: true } } } },
      },
    }),
    period.from
      ? null
      : db.order.findFirst({
          where: { status: "PAID", items: { some: { sellerId: seller.id } } },
          orderBy: { paidAt: "asc" },
          select: { paidAt: true },
        }),
    db.announcement.findMany({ where: { active: true }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.dispute.count({ where: { status: "RESOLVED_REFUND", orderItem: { sellerId: seller.id } } }),
  ]);

  const byKey = new Map(series.map((r) => [r.k, r]));
  const slots = periodSlots(period, first?.paidAt).map((s) => {
    const r = byKey.get(s.key);
    return { ...s, gross: Number(r?.gross ?? 0), net: Number(r?.net ?? 0), orders: Number(r?.orders ?? 0) };
  });
  const max = Math.max(1, ...slots.map((s) => s[metric]));
  const show = (v: number) => (metric === "orders" ? num(v) : money(v));
  const monthName = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ar-EG", { month: "short", timeZone: "Africa/Cairo" });
  const change = (k: keyof Totals) => (before ? percentChange(now[k], before[k]) : null);
  const tier = SELLER_TIERS[seller.type];
  const reviews = seller.positiveReviews + seller.negativeReviews;
  const banner = KYC_BANNER[seller.kycStatus];
  const params = { p: query.p, from: query.from, to: query.to, product: product || undefined, m: query.m };

  return (
    <Page>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold lg:text-3xl">{seller.storeName}</h1>
        <Pill tone="grey">{t(tier.label)}</Pill>
        {seller.kycStatus === "APPROVED" && <Pill tone="green">✓ {t(tier.badge)}</Pill>}
      </div>

      {banner && (
        <div className={`flex flex-wrap items-center gap-3 rounded-2xl p-4 text-sm ${banner.cls}`}>
          <p className="flex-1">{t(banner.text)}</p>
          {banner.cta && <Link href="/seller/kyc" className="btn-primary">{t("وثّق حسابك")}</Link>}
        </div>
      )}
      {seller.salesSuspendedAt && (
        <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          <p className="font-bold">{t("الإدارة وقفت البيع في متجرك مؤقتاً")}</p>
          <p>{t("السبب: ")}{seller.salesSuspendReason}</p>
          <p>{t("منتجاتك مش ظاهرة للمشترين لحد ما المشكلة تتحل. ردّ على العميل في الطلب أو كلّم الدعم.")}</p>
        </div>
      )}
      {seller.payoutsFrozenAt && (
        <p role="alert" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">{t("الإدارة جمّدت السحب من متجرك: ")}{seller.payoutsFrozenReason}</p>
      )}
      {news.map((n) => (
        <div key={n.id} className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-bold">📢 {n.title}</p>
          <p className="whitespace-pre-wrap">{n.body}</p>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <PeriodTabs period={period} params={params} keys={["today", "yesterday", "7d", "30d", "6m"]} />
        <form>
          {Object.entries({ ...params, product: undefined }).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
          <Select
          name="product"
          label={t("المنتج")}
          value={product}
          options={[{ value: "", label: t("كل المنتجات") }, ...products.map((p) => ({ value: p.id, label: p.title }))]}
          />
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:gap-4 xl:grid-cols-4">
        <Kpi label={t("قيمة المبيعات")} value={money(now.gross)}><Change value={change("gross")} /></Kpi>
        <Kpi label={t("صافي أرباحك")} value={money(now.net)}><Change value={change("net")} /></Kpi>
        <Kpi label={t("عدد الطلبات")} value={num(now.orders)}><Change value={change("orders")} /></Kpi>
        <Kpi label={t("متوسط الطلب")} value={money(now.orders ? Math.round(now.gross / now.orders) : 0)}>
          <Change value={before ? percentChange(now.orders ? now.gross / now.orders : 0, before.orders ? before.gross / before.orders : 0) : null} />
        </Kpi>
      </div>

      <Panel className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="me-auto text-lg font-bold">{t(METRICS[metric])}</h2>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm">
            {(Object.keys(METRICS) as Metric[]).map((m) => (
              <Link
                key={m}
                href={withParams(params, { m: m === "gross" ? undefined : m })}
                className={`rounded-lg px-3 py-1 font-semibold ${metric === m ? "bg-(--surface) shadow-sm" : "text-slate-500"}`}
              >
                {t(METRICS[m])}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex h-64 items-end gap-1 border-b border-slate-200" dir="ltr">
          {slots.map((s) => {
            const label = period.bucket === "month" ? monthName.format(s.start) : day(s.start);
            return (
              <div key={s.key} className="group relative flex h-full flex-1 flex-col justify-end">
                <div
                  className={`w-full rounded-t-md ${s[metric] ? "bg-brand-500 group-hover:bg-brand-600" : "bg-slate-100"}`}
                  style={{ height: `${Math.max(1.5, (s[metric] / max) * 100)}%` }}
                />
                <div className="pointer-events-none absolute bottom-full start-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-xl bg-white p-3 text-xs whitespace-nowrap text-slate-900 shadow-xl ring-1 ring-black/5 group-hover:block" dir="auto">
                  <p className="mb-1 text-slate-500">{label}</p>
                  <p className="font-bold">{show(s[metric])}</p>
                  <p className="text-slate-500">{t("{count} طلب", { count: num(s.orders) })}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-slate-500" dir="ltr">
          {slots.filter((_, i) => i % Math.ceil(slots.length / 8) === 0).map((s) => (
            <span key={s.key}>{period.bucket === "month" ? monthName.format(s.start) : s.key.slice(5).replace("-", "/")}</span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <span className="size-2.5 rounded-full bg-brand-500" />
          <span className="font-semibold">{t(METRICS[metric])}</span>
          <span className="text-slate-500">{t("خلال الفترة")}</span>
          <span className="ms-auto font-bold">{show(now[metric])}</span>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Panel>
          <div className="mb-4 flex items-center">
            <h2 className="me-auto text-lg font-bold">{t("آخر الطلبات")}</h2>
            <Link href="/seller/sales" className="text-sm font-semibold text-brand-600">{t("كل الطلبات")}</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>{t("المنتج")}</th>
                  <th>{t("الطلب")}</th>
                  <th>{t("التاريخ")}</th>
                  <th>{t("المشتري")}</th>
                  <th>{t("المبلغ")}</th>
                  <th>{t("الحالة")}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="max-w-64 truncate">
                      <Link className="hover:underline" href={`/seller/sales/${i.order.id}`}>{i.title}</Link>
                    </td>
                    <td>#{i.order.number}</td>
                    <td className="whitespace-nowrap">{i.order.paidAt && day(i.order.paidAt)}</td>
                    <td dir="ltr" className="text-start">{i.order.buyer.email}</td>
                    <td className="whitespace-nowrap">{money(i.total)}</td>
                    <td>
                      {i.refundedAmount > 0 ? (
                        <Pill tone="amber">{t("مسترد")}</Pill>
                      ) : i.deliveredAt ? (
                        <Pill tone="green">{t("اتسلّم")}</Pill>
                      ) : (
                        <Pill tone="blue">{t("مراجعة الإدارة")}</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!recent.length && <p className="p-6 text-center text-slate-500">{t("لسه مفيش مبيعات.")}</p>}
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel>
            <h2 className="mb-3 text-lg font-bold">{t("الأكثر مبيعاً في الفترة")}</h2>
            <div className="divide-y divide-slate-200 text-sm">
              {top.map((row) => (
                <div key={row.productId} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate">{row.title}</span>
                  <span className="text-slate-500">{num(row._sum.quantity ?? 0)}{t(" قطعة")}</span>
                  <span className="font-semibold">{money(row._sum.sellerNet ?? 0)}</span>
                </div>
              ))}
              {!top.length && <p className="py-4 text-slate-500">{t("مفيش مبيعات في الفترة دي.")}</p>}
            </div>
          </Panel>
          <Panel>
            <h2 className="mb-3 text-lg font-bold">{t("متجرك")}</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Fact label={t("قابل للسحب")} value={money(balance.available)} />
              <Fact label={t("معلّق")} value={money(balance.held)} />
              <Fact label={t("المنتجات")} value={`${num(products.length)} / ${num(tier.maxActiveProducts)}`} />
              <Fact
                label={t("نسبة الرضا")}
                value={reviews ? `${num(Math.round((seller.positiveReviews / reviews) * 100))}%` : "—"}
              />
              <Fact label={t("تقييمات")} value={`${num(seller.positiveReviews)} 👍 · ${num(seller.negativeReviews)} 👎`} />
              <Fact label={t("شكاوى اترد فلوسها")} value={num(refunds)} />
            </dl>
          </Panel>
        </div>
      </div>
    </Page>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-bold">{value}</dd>
    </div>
  );
}
