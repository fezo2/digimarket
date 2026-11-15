"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { AFFILIATE_COOKIE } from "@/lib/affiliate-rules";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PricingError } from "@/lib/pricing";
import { getSession, requireVerifiedUser } from "@/lib/auth";
import { createOrder, OrderError } from "@/lib/orders";
import { db } from "@/lib/db";
import { isListed } from "@/lib/catalog";
import { readCart, writeCart } from "@/lib/cart";
import { addLine } from "@/lib/cart-lines";
import { recordProductEvent, visitorKey } from "@/lib/product-analytics";
import { VISITOR_COOKIE } from "@/lib/visitor";

type State = { error?: string; added?: boolean } | undefined;

function readForm(form: FormData) {
  const quantity = z.coerce.number().int().min(1).safeParse(form.get("quantity"));
  const selections: Record<string, string> = {};
  const textInputs: Record<string, string> = {};
  for (const [key, value] of form) {
    if (typeof value !== "string" || !value) continue;
    if (key.startsWith("select:")) selections[key.slice(7)] = value;
    if (key.startsWith("text:")) textInputs[key.slice(5)] = value.trim();
  }
  return { quantity: quantity.success ? quantity.data : null, selections, textInputs };
}

export async function buyProduct(
  productId: string,
  slug: string,
  _: State,
  form: FormData,
): Promise<State> {
  const user = await requireVerifiedUser(`/products/${encodeURIComponent(slug)}`);
  const { quantity, selections, textInputs } = readForm(form);
  if (!quantity) return { error: "اكتب كمية صحيحة" };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim().slice(0, 64);
  const country = h.get("x-vercel-ip-country")?.slice(0, 8);
  let id: string;
  try {
    id = (
      await createOrder({
        buyerId: user.id,
        productId,
        quantity,
        selections,
        textInputs,
        buyerIp: ip || undefined,
        buyerCountry: country || undefined,
        affiliateCode: (await cookies()).get(AFFILIATE_COOKIE)?.value,
      })
    ).id;
  } catch (error) {
    if (error instanceof OrderError || error instanceof PricingError)
      return { error: error.message };
    throw error;
  }
  // "Buy now" skips the cart; it still counts as the cart step of the funnel.
  await countCartAdd(productId);
  redirect(`/checkout/${id}`);
}

// Guests can add to the cart too; signing in is asked for at checkout.
export async function addToCart(
  productId: string,
  _: State,
  form: FormData,
): Promise<State> {
  const { quantity, selections, textInputs } = readForm(form);
  if (!quantity) return { error: "اكتب كمية صحيحة" };
  const p = await db.product.findUnique({
    where: { id: productId },
    include: { seller: true, options: { include: { values: true } } },
  });
  if (!p || !isListed(p)) return { error: "المنتج مش متاح للشراء دلوقتي" };
  if (quantity < p.minQty || quantity > p.maxQty)
    return { error: "الكمية خارج الحدود المسموحة" };
  for (const o of p.options) {
    const value = o.kind === "select" ? selections[o.id] : textInputs[o.id];
    if (o.required && !value)
      return { error: o.kind === "select" ? `اختار ${o.name}` : `اكتب ${o.name}` };
    if (o.kind === "select" && value && !o.values.some((v) => v.id === value))
      return { error: "اختيارات المنتج مش صحيحة" };
  }
  const known = (keys: Record<string, string>, kind: string) =>
    Object.keys(keys).every((id) => p.options.some((o) => o.id === id && o.kind === kind));
  if (!known(selections, "select") || !known(textInputs, "text"))
    return { error: "اختيارات المنتج مش صحيحة" };
  const next = addLine(
    await readCart(),
    { id: randomUUID().slice(0, 12), p: p.id, q: quantity, s: selections, t: textInputs },
    p.maxQty,
  );
  if (!next) return { error: "السلة مليانة، اشتري أو امسح منتجات منها الأول" };
  await writeCart(next);
  await countCartAdd(p.id);
  revalidatePath("/", "layout");
  return { added: true };
}

// Cart step (add to cart or buy now) for the admin and seller analytics (src/lib/product-analytics.ts).
async function countCartAdd(productId: string) {
  const [h, jar, session] = await Promise.all([headers(), cookies(), getSession()]);
  if (session?.role === "ADMIN") return;
  const agent = h.get("user-agent");
  await recordProductEvent({
    productId,
    kind: "CART",
    agent,
    userId: session?.userId,
    visitor: visitorKey({
      cookie: jar.get(VISITOR_COOKIE)?.value,
      ip: h.get("x-forwarded-for")?.split(",")[0].trim(),
      agent,
    }),
  });
}
