import Link from "next/link";
import { i18n } from "@/lib/prefs";
import { paginate } from "@/lib/pagination";
import {
  funnelSeries,
  productFunnel,
  SORTS,
  trendingProducts,
  type SortKey,
} from "@/lib/product-analytics";
import { parsePeriod, percentChange, periodSlots, withParams } from "@/lib/seller-period";
import { Change, Kpi, Pager, Panel, PeriodTabs, SearchBox } from "@/app/seller/ui";

type Params = Record<string, string | undefined>;

const PER_PAGE = 25;
const DAY = 86400000;

// One percent with a single decimal, or "—" when there is nothing to divide by.
function rate(part: number, whole: number) {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}

// Product analytics shared by the admin panel (every store) and the seller
// office (one store). `since` is a staff admin's start date: nothing before
// it is counted.
export async function ProductAnalyticsView({
  params,
  sellerId,
  since,
  path,
  title,
  showStore,
}: {
  params: Params;
  sellerId?: string;
  since?: Date | null;
  path: string;
  title: string;
  showStore: boolean;
}) {
  const { t, num, money, day } = await i18n();
  const period = parsePeriod(params, "7d");
  const clamp = (d: Date | null) => (since && (!d || d < since) ? since : d);
  const from = clamp(period.from) ?? new Date(period.to.getTime() - 30 * DAY);
  const prevFrom = clamp(period.prevFrom) ?? from;
  const sort: SortKey = (SORTS as readonly string[]).includes(params.sort ?? "")
    ? (params.sort as SortKey)
    : "views";
  const q = params.q?.trim().slice(0, 80) || undefined;
  const productId = params.product?.slice(0, 40) || undefined;
  const scope = { sellerId, q, productId };
  const page = Math.max(1, Number(params.page) || 1);
  const metric = params.m === "paid" ? "paid" : "views";

  const [funnel, previous, trending, series] = await Promise.all([
    productFunnel({ from, to: period.to }, scope, {
      sort,
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
    }),
    productFunnel({ from: prevFrom, to: from }, scope, { sort, take: 0, skip: 0 }),
    trendingProducts({ from, to: period.to, prevFrom }, { sellerId }, 8),
    funnelSeries({ from, to: period.to }, period.bucket, scope),
  ]);
  const { totals } = funnel;
  const before = prevFrom < from ? previous.totals : null;
  const pages = paginate(funnel.products, PER_PAGE, page);
  const focus = productId ? funnel.rows[0] : undefined;

  const slots = periodSlots({ ...period, from }).map((s) => ({
    ...s,
    views: series.views.get(s.key) ?? 0,
    paid: series.paid.get(s.key) ?? 0,
  }));
  const max = Math.max(1, ...slots.map((s) => s[metric]));
  const slotLabel = (s: (typeof slots)[number]) =>
    period.bucket === "hour" ? `${s.key.slice(11)}:00` : period.bucket === "month" ? s.key : day(s.start);

  const steps = [
    { label: t("زيارات المنتج"), hint: t("زائر مختلف لكل منتج في اليوم"), value: totals.views, prev: before?.views, from: null },
    { label: t("ضاف للسلة أو ضغط اشتري"), value: totals.carts, prev: before?.carts, from: totals.views },
    { label: t("وصل لصفحة الدفع"), value: totals.checkouts, prev: before?.checkouts, from: totals.carts },
    { label: t("دفع فعلاً"), value: totals.paid, prev: before?.paid, from: totals.checkouts },
  ];

  const sortHead = (key: SortKey, label: string) => (
    <th className="px-3 py-2 font-semibold whitespace-nowrap">
      <Link
        href={withParams(params, { sort: key === "views" ? undefined : key, page: undefined })}
        className={sort === key ? "text-slate-900 underline underline-offset-4" : "hover:text-slate-900"}
      >
        {label}
      </Link>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="me-auto text-2xl font-bold">{title}</h1>
        <PeriodTabs period={period} params={params} keys={["24h", "today", "7d", "30d"]} />
      </div>
      {since && (
        <p className="text-sm text-slate-500">
          {t("الأرقام من {date} وبعده بس", { date: day(since) })}
        </p>
      )}
      {focus && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <p className="me-auto">
            {t("بتعرض منتج واحد:")} <strong>{focus.title}</strong>
          </p>
          <Link href={withParams(params, { product: undefined, page: undefined })} className="btn-outline">
            {t("كل المنتجات")}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {steps.map((s) => (
          <Kpi key={s.label} label={s.label} value={num(s.value)} hint={s.hint}>
            {s.prev !== undefined && <Change value={percentChange(s.value, s.prev)} />}
            {s.from !== null && rate(s.value, s.from) !== null && (
              <span className="text-xs text-slate-500">
                {t("{rate}% من اللي قبلها", { rate: num(rate(s.value, s.from)!) })}
              </span>
            )}
          </Kpi>
        ))}
        <Kpi
          label={t("معدل التحويل")}
          value={rate(totals.paid, totals.views) === null ? "—" : `${num(rate(totals.paid, totals.views)!)}%`}
          hint={t("الطلبات المدفوعة ÷ الزيارات · إيراد {money}", { money: money(totals.revenue) })}
        />
      </div>

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="me-auto text-lg font-bold">
            {metric === "views" ? t("الزيارات") : t("الطلبات المدفوعة")}
          </h2>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm">
            {(["views", "paid"] as const).map((m) => (
              <Link
                key={m}
                href={withParams(params, { m: m === "views" ? undefined : m })}
                className={`rounded-lg px-3 py-1 font-semibold ${metric === m ? "bg-(--surface) shadow-sm" : "text-slate-500"}`}
              >
                {m === "views" ? t("الزيارات") : t("المدفوع")}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex h-48 items-end gap-1 border-b border-slate-200" dir="ltr">
          {slots.map((s) => (
            <div key={s.key} className="group relative flex h-full flex-1 flex-col justify-end">
              <div
                className={`w-full rounded-t-md ${s[metric] ? "bg-brand-500 group-hover:bg-brand-600" : "bg-slate-100"}`}
                style={{ height: `${Math.max(1.5, (s[metric] / max) * 100)}%` }}
              />
              <div
                className="pointer-events-none absolute bottom-full start-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-xl bg-white p-3 text-xs whitespace-nowrap text-slate-900 shadow-xl ring-1 ring-black/5 group-hover:block"
                dir="auto"
              >
                <p className="mb-1 text-slate-500">{slotLabel(s)}</p>
                <p className="font-bold">{t("{n} زيارة", { n: num(s.views) })}</p>
                <p className="text-slate-500">{t("{n} طلب مدفوع", { n: num(s.paid) })}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-500" dir="ltr">
          {slots
            .filter((_, i) => i % Math.max(1, Math.ceil(slots.length / 6)) === 0)
            .map((s) => (
              <span key={s.key}>
                {period.bucket === "hour" ? `${s.key.slice(11)}:00` : s.key.slice(5).replace("-", "/")}
              </span>
            ))}
        </div>
      </Panel>

      {!productId && (
        <Panel className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">{t("المنتجات الرائجة 🔥")}</h2>
            <p className="text-sm text-slate-500">
              {t("الأكثر زيارة في الفترة، والتغيير مقارنة بالفترة اللي قبلها")}
            </p>
          </div>
          {trending.length === 0 ? (
            <p className="text-sm text-slate-500">{t("لسه مفيش زيارات في الفترة دي")}</p>
          ) : (
            <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {trending.map((p, i) => {
                const change = percentChange(p.views, p.before);
                const hot = p.views >= 10 && (p.before === 0 || (change ?? 0) >= 50);
                return (
                  <li key={p.id}>
                    <Link
                      href={withParams(params, { product: p.id, page: undefined })}
                      className="card flex h-full gap-3 p-3 hover:border-brand-500"
                    >
                      <span className="text-lg font-bold text-slate-400">{num(i + 1)}</span>
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="size-12 shrink-0 rounded-lg bg-slate-100" />
                      )}
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="line-clamp-2 text-sm font-semibold">{p.title}</span>
                        {showStore && <span className="block text-xs text-slate-500">{p.storeName}</span>}
                        <span className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-bold">{t("{n} زيارة", { n: num(p.views) })}</span>
                          {p.before === 0 ? (
                            <span className="badge bg-blue-50 text-blue-700">{t("جديد")}</span>
                          ) : (
                            <Change value={change} />
                          )}
                          {hot && <span className="badge bg-amber-50 text-amber-800">{t("رايج")}</span>}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {t("{carts} سلة · {paid} مدفوع", { carts: num(p.carts), paid: num(p.paid) })}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      )}

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="me-auto text-lg font-bold">{t("أداء كل منتج")}</h2>
          <form className="flex w-full gap-2 sm:w-auto" action={path}>
            {Object.entries(params).map(
              ([k, v]) => v && k !== "q" && k !== "page" && <input key={k} type="hidden" name={k} value={v} />,
            )}
            <SearchBox value={q} placeholder={t("دور باسم المنتج")} />
          </form>
        </div>
        {funnel.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            {t("مفيش زيارات أو طلبات في الفترة دي")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-start text-slate-500">
                <tr className="border-b border-slate-200 text-start">
                  <th className="px-3 py-2 text-start font-semibold">{t("المنتج")}</th>
                  {sortHead("views", t("زيارات"))}
                  {sortHead("carts", t("سلة"))}
                  {sortHead("checkouts", t("وصل للدفع"))}
                  {sortHead("paid", t("دفع"))}
                  {sortHead("conversion", t("التحويل"))}
                  {sortHead("revenue", t("الإيراد"))}
                </tr>
              </thead>
              <tbody>
                {funnel.rows.map((r) => {
                  const conv = rate(r.paid, r.views);
                  return (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="max-w-80 px-3 py-2">
                        <Link
                          href={withParams(params, { product: r.id, page: undefined })}
                          className="line-clamp-2 font-semibold hover:text-brand-700"
                        >
                          {r.title}
                        </Link>
                        {showStore && <span className="text-xs text-slate-500">{r.storeName}</span>}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{num(r.views)}</td>
                      <td className="px-3 py-2 tabular-nums">{num(r.carts)}</td>
                      <td className="px-3 py-2 tabular-nums">{num(r.checkouts)}</td>
                      <td className="px-3 py-2 font-bold tabular-nums">{num(r.paid)}</td>
                      <td className="px-3 py-2 tabular-nums">{conv === null ? "—" : `${num(conv)}%`}</td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">{money(r.revenue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          page={pages.page}
          pages={pages.pages}
          params={params}
          path={path}
          total={funnel.products}
          perPage={PER_PAGE}
        />
        <p className="text-xs text-slate-400">
          {t("الزيارة بتتحسب مرة واحدة لكل زائر في اليوم، ومن غير البوتات وزيارات التاجر لمنتجه. الوصول للدفع = طلب اتعمل، والمدفوع = طلب اتدفع في الفترة.")}
        </p>
      </Panel>
    </div>
  );
}
