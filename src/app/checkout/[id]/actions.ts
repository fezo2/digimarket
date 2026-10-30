"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PricingError } from "@/lib/pricing";
import { requireUser } from "@/lib/auth";
import { applyCoupon, cancelPendingOrder, preparePayment, OrderError } from "@/lib/orders";
import { getPaymentProvider } from "@/lib/payments";

export async function changeCoupon(
  id: string,
  _: { error?: string } | undefined,
  form: FormData,
) {
  const user = await requireUser(`/checkout/${id}`);
  const code = z.string().trim().max(100).safeParse(form.get("code"));
  if (!code.success) return { error: "اكتب كود صحيح" };
  try {
    await applyCoupon(id, user.id, code.data);
  } catch (error) {
    if (error instanceof OrderError || error instanceof PricingError)
      return { error: error.message };
    throw error;
  }
  revalidatePath(`/checkout/${id}`);
  return {};
}

export async function payNow(
  id: string,
  previousState: { error?: string } | undefined,
) {
  const user = await requireUser(`/checkout/${id}`);
  void previousState;
  const parsed = z.string().min(1).max(100).safeParse(id);
  if (!parsed.success) return { error: "الطلب مش صحيح" };
  let url: string;
  try {
    const provider = getPaymentProvider();
    const order = await preparePayment(id, user.id, provider.name);
    url = await provider.createPayment(order);
  } catch (error) {
    if (error instanceof OrderError || error instanceof PricingError)
      return { error: error.message };
    throw error;
  }
  redirect(url);
}

export async function cancelOrder(
  id: string,
  previousState: { error?: string } | undefined,
) {
  const user = await requireUser(`/account/orders/${id}`);
  void previousState;
  try {
    await cancelPendingOrder(id, user.id);
  } catch (error) {
    if (error instanceof OrderError) return { error: error.message };
    throw error;
  }
  redirect(`/account/orders/${id}`);
}
