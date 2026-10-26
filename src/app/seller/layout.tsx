import { getCurrentUser } from "@/lib/auth";
import { unreadCounts } from "@/lib/chat";
import { db } from "@/lib/db";
import { PortalNav } from "@/components/portal-nav";

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
              { href: "/seller", label: "لوحة التحكم", icon: "📊", exact: true },
              { href: "/seller/sales", label: "المبيعات", icon: "🧾" },
              { href: "/seller/messages", label: "الرسائل", icon: "💬", count: unread },
              { href: "/seller/disputes", label: "الشكاوى", icon: "⚠️", count: disputes },
              { href: "/seller/reviews", label: "التقييمات", icon: "⭐" },
            ],
          },
          {
            title: "المتجر",
            items: [
              { href: "/seller/products", label: "المنتجات", icon: "📦" },
              { href: "/seller/wallet", label: "المحفظة والسحب", icon: "💰" },
              { href: "/seller/settings", label: "الإعدادات", icon: "⚙️" },
            ],
          },
        ]}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
