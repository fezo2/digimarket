import { i18n } from "@/lib/prefs";
import Link from "next/link";
import type { LedgerType, Prisma } from "@prisma/client";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { frozenAmount } from "@/lib/dispute-balance";
import { computeBalance, ledgerLabels } from "@/lib/ledger";
import { parsePeriod } from "@/lib/seller-period";
import { Select } from "../auto-select";
import { Empty, Page, Pager, Panel, PeriodTabs, SearchBox } from "../ui";

export async function generateMetadata() {
  return { title: (await i18n()).t("المالية") };
}

const PER_PAGE = 20;

// Balance at the top, every money movement below: GGSel's "Finance".
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; from?: string; to?: string; type?: string; q?: string; page?: string }>;
}) {
  const { t, money, date, day, time } = await i18n();
  const { seller } = await requireSeller();
  const query = await searchParams;
  const period = parsePeriod(query, "all");
  const type = query.type && query.type in ledgerLabels ? (query.type as LedgerType) : undefined;
  const q = (query.q ?? "").trim().replace(/^#/, "").slice(0, 100);
  const where: Prisma.LedgerEntryWhereInput = {
    sellerId: seller.id,
    ...(type ? { type } : {}),
    ...(period.from ? { createdAt: { gte: period.from, lt: period.to } } : {}),
    ...(q
      ? {
          OR: [
            ...(/^\d{1,9}$/.test(q) ? [{ orderItem: { order: { number: Number(q) } } }] : []),
            { id: q },
            { note: { contains: q, mode: "insensitive" as const } },
            { orderItem: { title: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const [all, frozen, total] = await Promise.all([
    db.ledgerEntry.findMany({
      where: { sellerId: seller.id },
      select: { amount: true, availableAt: true },
    }),
    frozenAmount(seller.id, db),
    db.ledgerEntry.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(query.page) || 1));
  const entries = await db.ledgerEntry.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
    include: {
      orderItem: { select: { title: true, order: { select: { id: true, number: true } } } },
    },
  });
  const now = new Date();
  const balance = computeBalance(all, now);
  const next = all
    .filter((e) => e.availableAt > now && e.amount > 0)
    .sort((a, b) => a.availableAt.getTime() - b.availableAt.getTime())[0];
  const params = { p: query.p, from: query.from, to: query.to, type, q: q || undefined };
  const title = (e: (typeof entries)[number]) => {
    const order = e.orderItem?.order.number;
    if (e.type === "SALE" && order) return t("بيع منتج، طلب #{number}", { number: order });
    if (e.type === "REFUND" && order) return t("استرداد طلب #{number}", { number: order });
    return e.note ?? t(ledgerLabels[e.type]);
  };

  return (
    <Page>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card flex flex-wrap items-center gap-4 p-6">
          <div className="me-auto">
            <p className="text-sm text-slate-500">{t("الرصيد المتاح للسحب")}</p>
            <p className="mt-1 text-3xl font-bold">{money(balance.available - frozen)}</p>
            {frozen > 0 && (
              <p className="mt-1 text-xs text-amber-700">{t("مبلغ مجمّد بسبب شكوى: ")}{money(frozen)}</p>
            )}
          </div>
          <Link href="/seller/wallet/withdraw" className="btn-primary px-6">
            {t("سحب")}
          </Link>
        </section>
        <section className="card p-6">
          <p className="text-sm text-slate-500" title={t("أرباح لسه في فترة الضمان، بتتحول للرصيد المتاح تلقائياً")}>
            {t("في انتظار الإتاحة")}
          </p>
          <p className="mt-1 text-3xl font-bold">{money(balance.held)}</p>
          {next && <p className="mt-1 text-xs text-slate-500">{t("أقرب إتاحة: ")}{date(next.availableAt)}</p>}
        </section>
      </div>
      {seller.payoutsFrozenAt && (
        <p role="alert" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
          {t("الإدارة جمّدت السحب من متجرك: ")}{seller.payoutsFrozenReason}{t(". كلّم الدعم عشان تحل المشكلة.")}
        </p>
      )}

      <h2 className="text-2xl font-bold">{t("سجل العمليات")}</h2>
      <PeriodTabs period={period} params={params} keys={["all", "today", "yesterday", "7d", "30d"]} />
      <Panel className="space-y-5">
        <form className="flex flex-wrap gap-3">
          {(["p", "from", "to"] as const).map((k) => params[k] && <input key={k} type="hidden" name={k} value={params[k]} />)}
          <Select
            name="type"
            label={t("نوع العملية")}
            value={type}
            options={[
              { value: "", label: t("كل أنواع العمليات") },
              ...Object.entries(ledgerLabels).map(([value, label]) => ({ value, label: t(label) })),
            ]}
          />
          <SearchBox value={q} placeholder={t("رقم الطلب أو اسم المنتج أو رقم العملية")} />
        </form>
        {entries.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>{t("نوع العملية")}</th>
                  <th>{t("الوصف")}</th>
                  <th>{t("رقم العملية")}</th>
                  <th>{t("التاريخ")}</th>
                  <th>{t("على الرصيد")}</th>
                  <th>{t("متاح من")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="font-semibold whitespace-nowrap">{t(ledgerLabels[e.type])}</td>
                    <td className="max-w-md">
                      {e.orderItem ? (
                        <Link className="underline-offset-4 hover:underline" href={`/seller/sales/${e.orderItem.order.id}`}>
                          {title(e)}
                        </Link>
                      ) : (
                        title(e)
                      )}
                      {e.orderItem && <p className="truncate text-xs text-slate-500">{e.orderItem.title}</p>}
                    </td>
                    <td className="font-mono text-xs text-slate-500" dir="ltr" title={e.id}>{e.id.slice(-8)}</td>
                    <td className="whitespace-nowrap">{day(e.createdAt)} {time(e.createdAt)}</td>
                    <td className={`font-bold whitespace-nowrap ${e.amount >= 0 ? "text-emerald-700" : "text-red-700"}`} dir="ltr">
                      {e.amount >= 0 ? "+ " : "− "}
                      {money(Math.abs(e.amount))}
                    </td>
                    <td className="whitespace-nowrap text-slate-500">{e.availableAt > now ? day(e.availableAt) : t("متاح")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="finance" title={t("لسه مفيش حركات.")} />
        )}
        <Pager page={page} pages={pages} params={params} />
      </Panel>
    </Page>
  );
}
