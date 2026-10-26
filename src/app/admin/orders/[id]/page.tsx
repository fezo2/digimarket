import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { communityId } from "@/lib/community-rules";
import { OrderChat } from "@/components/order-chat";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const id = communityId.safeParse((await params).id);
  if (!id.success) notFound();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">محادثة الطلب</h1>
      <OrderChat userId={user.id} orderId={id.data} />
    </div>
  );
}
