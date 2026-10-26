import Link from "next/link";
import { db } from "@/lib/db";

export const metadata = { title: "لوحة الإدارة" };

export default async function AdminHome() {
  const [users, sellers, approved, pendingKyc, products] = await Promise.all([
    db.user.count(),
    db.sellerProfile.count(),
    db.sellerProfile.count({ where: { kycStatus: "APPROVED" } }),
    db.kycSubmission.count({ where: { status: "PENDING" } }),
    db.product.count({ where: { status: "ACTIVE" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">لوحة الإدارة</h1>
      <div className="grid gap-4 sm:grid-cols-5">
        {[
          ["المستخدمين", users],
          ["التجار", sellers],
          ["تجار موثّقين", approved],
          ["منتجات نشطة", products],
        ].map(([label, n]) => (
          <div key={label} className="card p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold">{Number(n).toLocaleString("ar-EG")}</p>
          </div>
        ))}
        <Link href="/admin/kyc" className="card border-brand-500 p-4">
          <p className="text-sm text-slate-500">توثيق مستني مراجعة</p>
          <p className="mt-1 text-2xl font-bold text-brand-700">{pendingKyc.toLocaleString("ar-EG")}</p>
        </Link>
      </div>
    </div>
  );
}
