import Link from "next/link";
import { i18n } from "@/lib/prefs";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_STORE_CATEGORIES } from "@/lib/store-categories";
import { siteHref } from "@/lib/sites";
import { Icon } from "../icons";
import { Empty, Page, PageTitle, Panel } from "../ui";
import { NewStoreCategoryForm, RenameStoreCategory, StoreCategoryButton } from "./forms";

export async function generateMetadata() {
  return { title: (await i18n()).t("تصنيفات المتجر") };
}

// The seller's own categories. Buyers see them as filters on the store page.
export default async function StoreCategoriesPage() {
  const { t, num } = await i18n();
  const { seller } = await requireSeller("PRODUCTS");
  const [categories, uncategorized] = await Promise.all([
    db.storeCategory.findMany({
      where: { sellerId: seller.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, _count: { select: { products: true } } },
    }),
    db.product.count({ where: { sellerId: seller.id, storeCategoryId: null } }),
  ]);
  const storeUrl = siteHref("store", `/stores/${encodeURIComponent(seller.slug)}`);

  return (
    <Page>
      <PageTitle title={t("تصنيفات المتجر")}>
        {seller.kycStatus === "APPROVED" && (
          <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="btn-outline">
            {t("صفحة متجري ↗")}
          </a>
        )}
      </PageTitle>
      <Panel className="space-y-4">
        <p className="text-sm text-slate-500">
          {t("قسّم منتجاتك بالطريقة اللي تناسبك، والمشتري هيلاقيها كفلاتر في صفحة متجرك. دي غير أقسام الموقع العامة ومش بتأثر على العمولة.")}
        </p>
        {categories.length < MAX_STORE_CATEGORIES ? (
          <NewStoreCategoryForm />
        ) : (
          <p className="text-sm text-amber-700">{t("وصلت للحد الأقصى للتصنيفات")}</p>
        )}
      </Panel>
      <Panel>
        {categories.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>{t("الترتيب")}</th>
                  <th>{t("الاسم")}</th>
                  <th>{t("المنتجات")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {categories.map((c, i) => (
                  <tr key={c.id} className="border-t">
                    <td className="whitespace-nowrap">
                      <div className="flex gap-1">
                        <StoreCategoryButton id={c.id} operation="up" label={t("لفوق")} disabled={i === 0} className="btn-outline px-2 py-1 disabled:opacity-30">
                          <Icon name="up" className="size-4" />
                        </StoreCategoryButton>
                        <StoreCategoryButton id={c.id} operation="down" label={t("لتحت")} disabled={i === categories.length - 1} className="btn-outline px-2 py-1 disabled:opacity-30">
                          <Icon name="down" className="size-4" />
                        </StoreCategoryButton>
                      </div>
                    </td>
                    <td className="min-w-72">
                      <RenameStoreCategory id={c.id} name={c.name} />
                    </td>
                    <td className="whitespace-nowrap">
                      <Link className="font-semibold underline-offset-4 hover:underline" href={`/seller/products?sc=${c.id}`}>
                        {num(c._count.products)}
                      </Link>
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <StoreCategoryButton id={c.id} operation="delete" label={t("حذف")} className="btn px-3 py-1.5 text-red-600 hover:bg-red-50" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="folder" title={t("لسه معندكش تصنيفات")} text={t("ضيف أول تصنيف فوق، وبعدين اختار التصنيف لكل منتج من صفحة المنتجات.")} />
        )}
        {categories.length > 0 && uncategorized > 0 && (
          <p className="mt-4 text-sm text-slate-500">
            <Link className="underline underline-offset-4" href="/seller/products?sc=none">
              {t("{count} منتج من غير تصنيف", { count: num(uncategorized) })}
            </Link>
          </p>
        )}
      </Panel>
    </Page>
  );
}
