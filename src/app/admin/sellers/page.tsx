import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
export default async function Sellers() {
  await requireAdmin();
  const sellers = await db.sellerProfile.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, storeName: true },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">أرصدة التجار</h1>
      {sellers.map((s) => (
        <Link
          key={s.id}
          className="card block p-4"
          href={`/admin/sellers/${s.id}/ledger`}
        >
          {s.storeName}
        </Link>
      ))}
    </div>
  );
}
