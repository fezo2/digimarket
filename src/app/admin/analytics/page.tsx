import { i18n } from "@/lib/prefs";
import { requireAdmin } from "@/lib/auth";
import { ProductAnalyticsView } from "@/components/product-analytics-view";

export async function generateMetadata() {
  return { title: (await i18n()).t("تحليلات المنتجات") };
}
export const dynamic = "force-dynamic";

export default async function AdminAnalytics({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { t } = await i18n();
  const admin = await requireAdmin();
  return (
    <ProductAnalyticsView
      params={await searchParams}
      since={admin.adminDataFrom}
      path="/admin/analytics"
      title={t("تحليلات المنتجات")}
      showStore
    />
  );
}
