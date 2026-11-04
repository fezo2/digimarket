"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PricingError } from "@/lib/pricing";
import { requireVerifiedUser } from "@/lib/auth";
import { createOrder, OrderError } from "@/lib/orders";
import { db } from "@/lib/db";
import { readCart, writeCart } from "@/lib/cart";

export async function removeFromCart(lineId: string) {
  await writeCart((await readCart()).filter((l) => l.id !== lineId));
  revalidatePath("/", "layout");
}

export async function setCartQuantity(lineId: string, form: FormData) {
  const q = z.coerce.number().int().min(1).safeParse(form.get("quantity"));
  if (!q.success) return;
  const lines = await readCart();
  const line = lines.find((l) => l.id === lineId);
  if (!line) return;
  const p = await db.product.findUnique({
    where: { id: line.p },
    select: { minQty: true, maxQty: true },
  });
  if (!p) return;
  const quantity = Math.max(p.minQty, Math.min(p.maxQty, q.data));
  await writeCart(lines.map((l) => (l.id === lineId ? { ...l, q: quantity } : l)));
  revalidatePath("/cart");
}

// One order per cart line: the order is made, the line leaves the cart, and
// the buyer goes to that order's payment page.
export async function checkoutCartLine(lineId: string) {
  const user = await requireVerifiedUser("/cart");
  const lines = await readCart();
  const line = lines.find((l) => l.id === lineId);
  if (!line) redirect("/cart");
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim().slice(0, 64);
  const country = h.get("x-vercel-ip-country")?.slice(0, 8);
  let id: string;
  try {
    id = (
      await createOrder({
        buyerId: user.id,
        productId: line.p,
        quantity: line.q,
        selections: line.s,
        textInputs: line.t,
        buyerIp: ip || undefined,
        buyerCountry: country || undefined,
      })
    ).id;
  } catch (error) {
    if (error instanceof OrderError || error instanceof PricingError)
      redirect(`/cart?line=${encodeURIComponent(lineId)}&error=${encodeURIComponent(error.message)}`);
    throw error;
  }
  await writeCart(lines.filter((l) => l.id !== lineId));
  revalidatePath("/", "layout");
  redirect(`/checkout/${id}`);
}
