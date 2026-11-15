import { i18n } from "@/lib/prefs";
import { requireSeller } from "@/lib/auth";
import { ProductAnalyticsView } from "@/components/product-analytics-view";
import { Page } from "../ui";

export async function generateMetadata() {
  return { title: (await i18n()).t("إحصائيات المنتجات") };
}
export const dynamic = "force-dynamic";

export default async function SellerAnalytics({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { t } = await i18n();
  const { seller } = await requireSeller(["PRODUCTS", "ORDERS"]);
  return (
    <Page>
      <ProductAnalyticsView
        params={await searchParams}
        sellerId={seller.id}
        path="/seller/analytics"
        title={t("إحصائيات المنتجات")}
        showStore={false}
      />
    </Page>
  );
}
