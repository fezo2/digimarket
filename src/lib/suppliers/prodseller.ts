import "server-only";

// Client for the ProdSeller reseller API (https://prodseller.com/api-docs/).
// Prices come back in USDT; the key lives only in PRODSELLER_API_KEY.

export type SupplierProduct = {
  id: string;
  name: string;
  description: string;
  priceMills: number;
  imageUrl: string | null;
  stock: number | null;
  needsEmail: boolean;
};

export type SupplierOrder = {
  orderId: string;
  status: string;
  keys: string[];
};

// A 4xx answer is final for this attempt (no balance, out of stock, bad id).
// Anything else (network, 429, 5xx) may be retried with the same key.
export class SupplierError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
  get final() {
    return this.status >= 400 && this.status < 500 && this.status !== 429;
  }
}

export function prodsellerConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.PRODSELLER_API_KEY);
}

const base = () =>
  (process.env.PRODSELLER_API_URL || "https://prodseller.com/v1").replace(/\/$/, "");

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; idempotencyKey?: string } = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const key = process.env.PRODSELLER_API_KEY;
  if (!key) throw new SupplierError("مفتاح ProdSeller مش متضاف", 401);
  let res: Response;
  try {
    res = await fetcher(base() + path, {
      method: init.method ?? "GET",
      headers: {
        "X-API-Key": key,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
  } catch {
    throw new SupplierError("مفيش اتصال بـ ProdSeller", 0);
  }
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!res.ok)
    throw new SupplierError(
      `ProdSeller: ${String(data?.error ?? res.status).slice(0, 200)}`,
      res.status,
    );
  if (!data) throw new SupplierError("رد ProdSeller مش مفهوم", 502);
  return data;
}

export const toMills = (usd: unknown) => {
  const n = Number(usd);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) : 0;
};

const stockOf = (raw: Record<string, unknown>) => {
  if (typeof raw.stock === "number") return raw.stock;
  if (typeof raw.inStock === "number") return raw.inStock;
  if (typeof raw.inStock === "boolean") return raw.inStock ? null : 0;
  return null;
};

function product(raw: Record<string, unknown>): SupplierProduct {
  return {
    id: String(raw.id),
    name: String(raw.name ?? "").trim(),
    description: String(raw.description ?? "").trim(),
    priceMills: toMills(raw.price),
    imageUrl: typeof raw.imageUrl === "string" && raw.imageUrl ? raw.imageUrl : null,
    stock: stockOf(raw),
    needsEmail: raw.requiresEmailActivation === true,
  };
}

export async function listProducts(fetcher?: typeof fetch) {
  const data = await call<{ products: Record<string, unknown>[] }>(
    "/products",
    {},
    fetcher,
  );
  return (data.products ?? []).filter((p) => p && p.id).map(product);
}

export async function getProduct(id: string, fetcher?: typeof fetch) {
  return product(
    await call<Record<string, unknown>>(
      `/products/${encodeURIComponent(id)}`,
      {},
      fetcher,
    ),
  );
}

export async function getBalance(fetcher?: typeof fetch) {
  const data = await call<{ balance: number; membership?: string }>(
    "/balance",
    {},
    fetcher,
  );
  return { balance: Number(data.balance) || 0, membership: data.membership ?? "" };
}

function order(raw: Record<string, unknown>): SupplierOrder {
  const many = Array.isArray(raw.deliveredKeys)
    ? raw.deliveredKeys.map(String)
    : [];
  const keys = many.length
    ? many
    : typeof raw.deliveredKey === "string" && raw.deliveredKey
      ? [raw.deliveredKey]
      : [];
  return {
    orderId: String(raw.orderId ?? ""),
    status: String(raw.status ?? ""),
    keys: keys.map((k) => k.trim()).filter(Boolean),
  };
}

export async function buy(
  productId: string,
  quantity: number,
  idempotencyKey: string,
  fetcher?: typeof fetch,
) {
  return order(
    await call<Record<string, unknown>>(
      "/orders",
      { method: "POST", body: { productId, quantity }, idempotencyKey },
      fetcher,
    ),
  );
}

export async function getOrder(id: string, fetcher?: typeof fetch) {
  return order(
    await call<Record<string, unknown>>(
      `/orders/${encodeURIComponent(id)}`,
      {},
      fetcher,
    ),
  );
}
