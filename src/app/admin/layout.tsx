import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PortalNav } from "@/components/portal-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  const [kyc, products, payments, payouts, disputes, flagged, repay] = await Promise.all([
    db.kycSubmission.count({ where: { status: "PENDING" } }),
    db.product.count({ where: { status: "PENDING_REVIEW" } }),
    db.manualPayment.count({ where: { status: "SUBMITTED" } }),
    db.payout.count({ where: { status: "REQUESTED" } }),
    db.dispute.count({ where: { status: "OPEN" } }),
    db.message.count({
      where: { flagged: true, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
    }),
    db.order.count({ where: { status: "REFUNDED", refundPaidAt: null } }),
  ]);
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
      <PortalNav
        groups={[
          {
            items: [{ href: "/admin", label: "نظرة عامة", icon: "📊", exact: true }],
          },
          {
            title: "الفلوس",
            items: [
              { href: "/admin/payments", label: "التحويلات اليدوية", icon: "💳", count: payments },
              { href: "/admin/payouts", label: "طلبات السحب", icon: "💸", count: payouts },
              { href: "/admin/orders", label: "الطلبات", icon: "🧾" },
              { href: "/admin/orders?repay=1", label: "مرتجعات للتحويل", icon: "↩️", count: repay },
            ],
          },
          {
            title: "الناس",
            items: [
              { href: "/admin/users", label: "المستخدمين", icon: "👤" },
              { href: "/admin/sellers", label: "التجار", icon: "🏪" },
              { href: "/admin/kyc", label: "طلبات التوثيق", icon: "🪪", count: kyc },
            ],
          },
          {
            title: "المراجعة",
            items: [
              { href: "/admin/disputes", label: "الشكاوى", icon: "⚠️", count: disputes },
              { href: "/admin/products", label: "مراجعة المنتجات", icon: "📦", count: products },
              { href: "/admin/reviews", label: "التقييمات", icon: "⭐" },
              { href: "/admin/messages", label: "الرسائل", icon: "💬", count: flagged },
            ],
          },
          {
            title: "المنصة",
            items: [
              { href: "/admin/categories", label: "الأقسام والعمولات", icon: "🗂️" },
              { href: "/admin/news", label: "إعلانات للتجار", icon: "📢" },
              { href: "/admin/audit", label: "سجل الإجراءات", icon: "📜" },
            ],
          },
        ]}
      />
      <div className="min-w-0 flex-1 px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </div>
    </div>
  );
}
