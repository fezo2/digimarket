import { i18n } from "@/lib/prefs";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PortalNav } from "@/components/portal-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = await i18n();
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
            items: [{ href: "/admin", label: t("نظرة عامة"), icon: "📊", exact: true }],
          },
          {
            title: t("الفلوس"),
            items: [
              { href: "/admin/payments", label: t("التحويلات اليدوية"), icon: "💳", count: payments },
              { href: "/admin/payouts", label: t("طلبات السحب"), icon: "💸", count: payouts },
              { href: "/admin/orders", label: t("الطلبات"), icon: "🧾" },
              { href: "/admin/orders?repay=1", label: t("مرتجعات للتحويل"), icon: "↩️", count: repay },
            ],
          },
          {
            title: t("الناس"),
            items: [
              { href: "/admin/users", label: t("المستخدمين"), icon: "👤" },
              { href: "/admin/sellers", label: t("التجار"), icon: "🏪" },
              { href: "/admin/kyc", label: t("طلبات التوثيق"), icon: "🪪", count: kyc },
            ],
          },
          {
            title: t("المراجعة"),
            items: [
              { href: "/admin/disputes", label: t("الشكاوى"), icon: "⚠️", count: disputes },
              { href: "/admin/products", label: t("مراجعة المنتجات"), icon: "📦", count: products },
              { href: "/admin/reviews", label: t("التقييمات"), icon: "⭐" },
              { href: "/admin/messages", label: t("الرسائل"), icon: "💬", count: flagged },
            ],
          },
          {
            title: t("المنصة"),
            items: [
              { href: "/admin/categories", label: t("الأقسام والعمولات"), icon: "🗂️" },
              { href: "/admin/news", label: t("إعلانات للتجار"), icon: "📢" },
              { href: "/admin/suppliers", label: t("ProdSeller"), icon: "⚡" },
              { href: "/admin/audit", label: t("سجل الإجراءات"), icon: "📜" },
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
