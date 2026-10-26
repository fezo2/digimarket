"use server";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getPaymentProvider } from "@/lib/payments";
import { db } from "@/lib/db";
import { markOrderPaid } from "@/lib/orders";

export async function testPayment(
  id: string,
  _: { error?: string } | undefined,
  form: FormData,
) {
  const user = await requireUser(`/pay/test/${id}`);
  if (getPaymentProvider().name !== "test") notFound();
  const decision = z
    .enum(["success", "failure"])
    .safeParse(form.get("decision"));
  if (!decision.success) return { error: "اختار نتيجة الدفع" };
  const order = await db.order.findFirst({
    where: { id, buyerId: user.id, paymentProvider: "test" },
  });
  if (!order) notFound();
  if (decision.data === "failure") redirect(`/checkout/${id}?error=failed`);
  await markOrderPaid(id, {
    provider: "test",
    reference: `test-${Date.now()}`,
    amount: order.total,
  });
  redirect(`/account/orders/${id}`);
}
