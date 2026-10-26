import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const GROUPS = [
  [
    ["/admin", "نظرة عامة"],
    ["/admin/users", "المستخدمين"],
    ["/admin/sellers", "التجار"],
    ["/admin/kyc", "طلبات التوثيق"],
  ],
  [
    ["/admin/orders", "الطلبات"],
    ["/admin/payments", "التحويلات اليدوية"],
    ["/admin/payouts", "طلبات السحب"],
    ["/admin/disputes", "الشكاوى"],
  ],
  [
    ["/admin/products", "مراجعة المنتجات"],
    ["/admin/reviews", "التعليقات والتقييمات"],
    ["/admin/messages", "الرسائل"],
    ["/admin/categories", "الأقسام والعمولات"],
  ],
  [
    ["/admin/news", "إعلانات للتجار"],
    ["/admin/audit", "سجل الإجراءات"],
  ],
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
        {GROUPS.map((group, i) => (
          <div key={i} className="flex flex-wrap gap-2 border-s ps-4 first:border-0 first:ps-0">
            {group.map(([href, label]) => (
              <Link key={href} href={href} className="btn-outline">
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      {children}
    </div>
  );
}
