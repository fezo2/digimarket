import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 flex gap-2 text-sm font-semibold">
        <Link href="/admin" className="btn-outline">نظرة عامة</Link>
        <Link href="/admin/orders" className="btn-outline">الطلبات</Link>
        <Link href="/admin/kyc" className="btn-outline">طلبات التوثيق</Link>
        <Link href="/admin/products" className="btn-outline">مراجعة المنتجات</Link>
        <Link href="/admin/categories" className="btn-outline">الأقسام والعمولات</Link>
      </nav>
      {children}
    </div>
  );
}
