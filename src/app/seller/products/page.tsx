import { i18n } from "@/lib/prefs";
import Link from "next/link";
import type { DeliveryType, Prisma } from "@prisma/client";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { statusLabels } from "@/lib/product-input";
import { siteHref } from "@/lib/sites";
import { ProductAction } from "./action-form";
import { Select } from "../auto-select";
import { Icon } from "../icons";
import { Menu } from "../shell";
import { Empty, Pager, Panel, PageTitle, Pill, SearchBox, Tabs } from "../ui";

export async function generateMetadata() {
  return { title: (await i18n()).t("المنتجات") };
}

const PER_PAGE = 20;

const DELIVERY = {
  UNIQUE_CODES: "أكواد من المخزون",
  FILE: "ملف",
  TEXT: "نص",
  LINK: "رابط",
} as const;

// "On sale" = buyers can order it now; "Stopped" = approved but switched
// off, paused or rejected; "Drafts" = not submitted or waiting for review.
const TABS = {
  sale: { status: "ACTIVE", salesEnabled: true },
  stopped: {
    OR: [{ status: "ACTIVE", salesEnabled: false }, { status: { in: ["PAUSED", "REJECTED"] } }],
  },
  drafts: { status: { in: ["DRAFT", "PENDING_REVIEW"] } },
} satisfies Record<string, Prisma.ProductWhereInput>;
type Tab = keyof typeof TABS;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; d?: string; page?: string }>;
}) {
  const { t, money, num, cat } = await i18n();
  const { seller } = await requireSeller();
  if (seller.kycStatus !== "APPROVED") return null;
  const query = await searchParams;
  const tab: Tab = query.tab && query.tab in TABS ? (query.tab as Tab) : "sale";
  const delivery = query.d && query.d in DELIVERY ? (query.d as DeliveryType) : undefined;
  const q = (query.q ?? "").trim().slice(0, 100);
  const filter: Prisma.ProductWhereInput = {
    sellerId: seller.id,
    ...(delivery ? { deliveryType: delivery } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { id: q }, { slug: q }] } : {}),
  };
  const where = { ...filter, AND: [TABS[tab]] };
  const [counts, total] = await Promise.all([
    Promise.all((Object.keys(TABS) as Tab[]).map((k) => db.product.count({ where: { ...filter, AND: [TABS[k]] } }))),
    db.product.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(query.page) || 1));
  const products = await db.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
    include: {
      category: true,
      _count: { select: { stock: { where: { status: "AVAILABLE" } } } },
    },
  });
  // Units sold per product over the last 1, 3 and 6 months.
  const now = Date.now();
  const sales = await db.$queryRaw<{ productId: string; m1: bigint; m3: bigint; m6: bigint }[]>`
    SELECT i."productId",
      COALESCE(SUM(i.quantity) FILTER (WHERE o."paidAt" >= ${new Date(now - 30 * 86400000)}), 0)::bigint AS m1,
      COALESCE(SUM(i.quantity) FILTER (WHERE o."paidAt" >= ${new Date(now - 91 * 86400000)}), 0)::bigint AS m3,
      COALESCE(SUM(i.quantity), 0)::bigint AS m6
    FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
    WHERE i."sellerId" = ${seller.id} AND o.status = 'PAID'
      AND o."paidAt" >= ${new Date(now - 182 * 86400000)}
      AND i."productId" = ANY(${products.map((p) => p.id)})
    GROUP BY 1`;
  const sold = new Map(sales.map((r) => [r.productId, r]));
  const n = (v: bigint | undefined) => num(Number(v ?? 0));
  const params = { tab: query.tab, q: q || undefined, d: delivery };
  const tabLabels: Record<Tab, string> = {
    sale: t("معروض للبيع"),
    stopped: t("موقوف"),
    drafts: t("مسودات ومراجعة"),
  };

  return (
    <>
      <PageTitle title={t("المنتجات")}>
        <ProductAction operation="stopAll" label={t("إيقاف كل المبيعات")} />
        <Link className="btn-primary" href="/seller/products/new">
          <Icon name="plus" className="size-4" />
          {t("إضافة منتج")}
        </Link>
      </PageTitle>
      <Panel className="space-y-5">
        <form className="flex flex-wrap gap-3">
          {query.tab && <input type="hidden" name="tab" value={query.tab} />}
          <Select
            name="d"
            label={t("نوع التسليم")}
            value={delivery}
            options={[
              { value: "", label: t("كل أنواع التسليم") },
              ...Object.entries(DELIVERY).map(([value, label]) => ({ value, label: t(label) })),
            ]}
          />
          <SearchBox value={q} placeholder={t("اسم المنتج أو الكود التعريفي")} />
        </form>
        <Tabs
          current={tab}
          params={params}
          tabs={(Object.keys(TABS) as Tab[]).map((k, i) => ({ key: k, label: tabLabels[k], count: counts[i] }))}
        />
        {products.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>{t("المنتج")}</th>
                  <th>{t("نوع التسليم")}</th>
                  <th>{t("القسم")}</th>
                  <th title={t("آخر شهر / ٣ شهور / ٦ شهور")}>{t("المبيعات")}</th>
                  <th>{t("السعر")}</th>
                  <th>{t("المخزون")}</th>
                  <th>{t("البيع")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr className="border-t" key={p.id}>
                    <td className="min-w-64">
                      <Link dir="auto" className="font-medium underline-offset-4 hover:underline" href={`/seller/products/${p.id}`}>
                        {p.title}
                      </Link>
                      {p.status !== "ACTIVE" && (
                        <span className="ms-2">
                          <Pill tone={p.status === "REJECTED" ? "red" : p.status === "PENDING_REVIEW" ? "blue" : "grey"}>
                            {t(statusLabels[p.status])}
                          </Pill>
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">{t(DELIVERY[p.deliveryType])}</td>
                    <td className="whitespace-nowrap text-slate-500">{cat(p.category)}</td>
                    <td className="whitespace-nowrap" title={t("الإجمالي: {count}", { count: num(p.soldCount) })}>
                      <span className="font-semibold">{n(sold.get(p.id)?.m1)}</span>
                      <span className="text-slate-400"> / {n(sold.get(p.id)?.m3)} / {n(sold.get(p.id)?.m6)}</span>
                    </td>
                    <td className="whitespace-nowrap font-semibold">{money(p.price)}</td>
                    <td>
                      {p.deliveryType === "UNIQUE_CODES" ? (
                        <Link
                          href={`/seller/products/${p.id}/stock`}
                          className={`font-semibold underline-offset-4 hover:underline ${p._count.stock ? "" : "text-red-600"}`}
                        >
                          {num(p._count.stock)}
                        </Link>
                      ) : (
                        <span title={t("بلا حدود")}>∞</span>
                      )}
                    </td>
                    <td>
                      {p.status === "ACTIVE" ? (
                        <ProductAction
                          id={p.id}
                          operation="toggle"
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            p.salesEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}
                          label={p.salesEnabled ? t("شغّال") : t("متوقف")}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <Menu label={t("خيارات المنتج")} button={<Icon name="more" />}>
                        <Link href={`/seller/products/${p.id}`}>{t("تعديل")}</Link>
                        {p.deliveryType === "UNIQUE_CODES" && (
                          <Link href={`/seller/products/${p.id}/stock`}>{t("الأكواد")}</Link>
                        )}
                        {p.status === "ACTIVE" && (
                          <a href={siteHref("store", `/products/${p.slug}`)} target="_blank" rel="noopener noreferrer">
                            {t("رابط الشراء المباشر ↗")}
                          </a>
                        )}
                        <ProductAction id={p.id} operation="clone" label={t("نسخ")} className="" />
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon="products"
            title={q || delivery ? t("مفيش نتايج") : t("مفيش منتجات هنا")}
            text={tab === "sale" && !q && !delivery ? t("لسه مفيش منتجات. ابدأ بإضافة أول منتج.") : undefined}
          >
            {tab === "sale" && !q && !delivery && (
              <Link className="btn-primary" href="/seller/products/new">
                <Icon name="plus" className="size-4" />
                {t("إضافة منتج")}
              </Link>
            )}
          </Empty>
        )}
        <Pager page={page} pages={pages} params={params} />
      </Panel>
    </>
  );
}
