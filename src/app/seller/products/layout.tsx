import Link from "next/link";
import { requireSeller } from "@/lib/auth";

export default async function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { seller } = await requireSeller();
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {seller.kycStatus === "APPROVED" ? (
        children
      ) : (
        <div className="card space-y-4 bg-amber-50 p-6">
          <p>لازم حسابك يتوثّق ويتوافق عليه قبل إدارة المنتجات.</p>
          <Link className="btn-primary" href="/seller/kyc">
            تابع توثيق حسابك
          </Link>
        </div>
      )}
    </div>
  );
}
