import { i18n } from "@/lib/prefs";
import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { Page } from "../ui";

export default async function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = await i18n();
  const { seller } = await requireSeller();
  return (
    <Page>
      {seller.kycStatus === "APPROVED" ? (
        children
      ) : (
        <div className="card space-y-4 bg-amber-50 p-6">
          <p>{t("لازم حسابك يتوثّق ويتوافق عليه قبل إدارة المنتجات.")}</p>
          <Link className="btn-primary" href="/seller/kyc">
            {t("تابع توثيق حسابك")}
          </Link>
        </div>
      )}
    </Page>
  );
}
