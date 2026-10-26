import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPaymentProvider } from "@/lib/payments";
import { db } from "@/lib/db";
import { releaseExpiredOrders } from "@/lib/orders";
import { formatEGP } from "@/lib/money";
import { TestForm } from "./test-form";

export default async function TestPayment({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/pay/test/${id}`);
  if (getPaymentProvider().name !== "test") notFound();
  await releaseExpiredOrders();
  const order = await db.order.findFirst({
    where: { id, buyerId: user.id, paymentProvider: "test" },
    select: { number: true, total: true, status: true },
  });
  if (!order) notFound();
  if (order.status !== "PENDING_PAYMENT") redirect(`/account/orders/${id}`);
  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <h1 className="text-2xl font-bold">دفع تجريبي — طلب #{order.number}</h1>
      <p>المبلغ: {formatEGP(order.total)}</p>
      <p>دي تجربة، مفيش فلوس هتتخصم.</p>
      <TestForm id={id} />
    </div>
  );
}
