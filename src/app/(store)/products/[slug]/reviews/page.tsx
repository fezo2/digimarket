import Link from "next/link";
import { listedProduct } from "@/lib/catalog";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { reviewPercent } from "@/lib/community-rules";
import { PublicReviews } from "@/components/public-reviews";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const page = Math.floor(
    Math.min(100000, Math.max(1, Number(query.page) || 1)),
  );
  const product = await db.product.findFirst({
    where: {
      slug,
      ...listedProduct,
    },
    select: {
      id: true,
      title: true,
      positiveReviews: true,
      negativeReviews: true,
    },
  });
  if (!product) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <h1 className="text-2xl font-bold">تقييمات {product.title}</h1>
      <p>{reviewPercent(product.positiveReviews, product.negativeReviews)}</p>
      <PublicReviews productId={product.id} page={page} size={20} />
      <nav className="flex gap-3">
        {page > 1 && (
          <Link className="btn-outline" href={`?page=${page - 1}`}>
            السابق
          </Link>
        )}
        {page * 20 < product.positiveReviews + product.negativeReviews && (
          <Link className="btn-outline" href={`?page=${page + 1}`}>
            التالي
          </Link>
        )}
      </nav>
    </div>
  );
}
