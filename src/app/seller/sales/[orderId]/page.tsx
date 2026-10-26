import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { communityId } from "@/lib/community-rules";
import { OrderChat } from "@/components/order-chat";
import { SellerReviewList } from "@/components/seller-review-list";
export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { user, seller } = await requireSeller();
  const id = communityId.safeParse((await params).orderId);
  if (!id.success) notFound();
  const order = await db.order.findFirst({
    where: {
      id: id.data,
      status: { in: ["PAID", "REFUNDED"] },
      items: { some: { sellerId: seller.id } },
    },
    select: {
      number: true,
      items: {
        select: {
          title: true,
          disputes: { where: { status: "OPEN" }, select: { id: true } },
        },
      },
    },
  });
  if (!order) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <h1 className="text-2xl font-bold">طلب #{order.number}</h1>
      {order.items.some((i) => i.disputes.length) && (
        <p className="card bg-amber-50 p-4">
          فيه شكوى مفتوحة على الطلب. رد على المشتري في المحادثة.
        </p>
      )}
      <SellerReviewList sellerId={seller.id} orderId={id.data} />
      <OrderChat userId={user.id} orderId={id.data} />
    </div>
  );
}
