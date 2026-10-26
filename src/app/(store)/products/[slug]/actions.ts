"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { PricingError } from "@/lib/pricing";
import { requireUser } from "@/lib/auth";
import { createOrder, OrderError } from "@/lib/orders";

export async function buyProduct(
  productId: string,
  slug: string,
  _: { error?: string } | undefined,
  form: FormData,
) {
  const user = await requireUser(`/products/${encodeURIComponent(slug)}`);
  const parsed = z.coerce.number().int().min(1).safeParse(form.get("quantity"));
  if (!parsed.success) return { error: "اكتب كمية صحيحة" };
  const selections: Record<string, string> = {};
  const textInputs: Record<string, string> = {};
  for (const [key, value] of form) {
    if (typeof value !== "string") continue;
    if (key.startsWith("select:")) selections[key.slice(7)] = value;
    if (key.startsWith("text:")) textInputs[key.slice(5)] = value;
  }
  let id: string;
  try {
    id = (
      await createOrder({
        buyerId: user.id,
        productId,
        quantity: parsed.data,
        selections,
        textInputs,
      })
    ).id;
  } catch (error) {
    if (error instanceof OrderError || error instanceof PricingError)
      return { error: error.message };
    throw error;
  }
  redirect(`/checkout/${id}`);
}
