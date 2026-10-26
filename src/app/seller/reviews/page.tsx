import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { SellerReviewList } from "@/components/seller-review-list";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { seller } = await requireSeller();
  const query = await searchParams;
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <h1 className="text-2xl font-bold">التقييمات</h1>
      <nav className="flex gap-3">
        {[
          ["", "الكل"],
          ["positive", "إيجابي"],
          ["negative", "سلبي"],
          ["unanswered", "من غير رد"],
        ].map(([value, label]) => (
          <Link key={value} className="btn-outline" href={`?filter=${value}`}>
            {label}
          </Link>
        ))}
      </nav>
      <SellerReviewList sellerId={seller.id} filter={query.filter} />
    </div>
  );
}
