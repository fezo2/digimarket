import { z } from "zod";

// The store cart lives in a cookie, so guests can fill it before signing in.
// Each line is one product with the buyer's choices; checkout still makes one
// order per line, since an order holds a single product.
export const CART_MAX_LINES = 20;
export const CART_MAX_BYTES = 3500;

const choices = z.record(z.string().max(100), z.string().max(300));

export const cartLine = z.object({
  id: z.string().min(1).max(40),
  p: z.string().min(1).max(100),
  q: z.number().int().min(1).max(100_000),
  s: choices.default({}),
  t: choices.default({}),
});
export type CartLine = z.infer<typeof cartLine>;

export function parseCart(raw: string | undefined): CartLine[] {
  if (!raw) return [];
  try {
    const parsed = z.array(cartLine).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.slice(0, CART_MAX_LINES) : [];
  } catch {
    return [];
  }
}

function sameChoices(a: Record<string, string>, b: Record<string, string>) {
  const ka = Object.keys(a).filter((k) => a[k]);
  const kb = Object.keys(b).filter((k) => b[k]);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

// Adds a line, or raises the quantity of the same product with the same
// choices (capped at maxQty). Returns null when the cart is full.
export function addLine(
  lines: CartLine[],
  line: CartLine,
  maxQty: number,
): CartLine[] | null {
  const i = lines.findIndex(
    (l) => l.p === line.p && sameChoices(l.s, line.s) && sameChoices(l.t, line.t),
  );
  if (i >= 0)
    return lines.map((l, j) =>
      j === i ? { ...l, q: Math.min(maxQty, l.q + line.q) } : l,
    );
  if (lines.length >= CART_MAX_LINES) return null;
  const next = [...lines, line];
  return JSON.stringify(next).length > CART_MAX_BYTES ? null : next;
}
