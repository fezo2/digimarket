import "server-only";
import { cookies } from "next/headers";
import { parseCart, type CartLine } from "./cart-lines";

export const CART_COOKIE = "dm_cart";

export async function readCart(): Promise<CartLine[]> {
  return parseCart((await cookies()).get(CART_COOKIE)?.value);
}

// Server actions only: Next lets cookies be written there.
export async function writeCart(lines: CartLine[]) {
  const jar = await cookies();
  if (lines.length === 0) {
    jar.delete(CART_COOKIE);
    return;
  }
  jar.set(CART_COOKIE, JSON.stringify(lines), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
