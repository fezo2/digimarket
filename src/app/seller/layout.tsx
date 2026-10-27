import { i18n } from "@/lib/prefs";
import { getCurrentUser } from "@/lib/auth";
import { unreadCounts } from "@/lib/chat";
import { db } from "@/lib/db";
import { PortalNav } from "@/components/portal-nav";

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = await i18n();
  const user = await getCurrentUser();
  const sellerId = user?.seller?.id;
  const [unread, disputes] = sellerId
    ? await Promise.all([
        unreadCounts(user.id, false, "seller").then((m) =>
          [...m.values()].filter((n) => n > 0).length,
        ),
        db.dispute.count({
          where: { status: "OPEN", orderItem: { sellerId } },
        }),
      ])
    : [0, 0];
  // Before joining there is no store yet, so no menu.
  if (!sellerId) return children;
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
      <PortalNav
        groups={[
          {
            items: [
              { href: "/seller", label: t("لوحة التحكم"), icon: "📊", exact: true },
              { href: "/seller/sales", label: t("المبيعات"), icon: "🧾" },
              { href: "/seller/messages", label: t("الرسائل"), icon: "💬", count: unread },
              { href: "/seller/disputes", label: t("الشكاوى"), icon: "⚠️", count: disputes },
              { href: "/seller/reviews", label: t("التقييمات"), icon: "⭐" },
            ],
          },
          {
            title: t("المتجر"),
            items: [
              { href: "/seller/products", label: t("المنتجات"), icon: "📦" },
              { href: "/seller/wallet", label: t("المحفظة والسحب"), icon: "💰" },
              { href: "/seller/settings", label: t("الإعدادات"), icon: "⚙️" },
            ],
          },
        ]}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
