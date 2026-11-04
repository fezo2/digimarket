import Link from "next/link";
import { i18n } from "@/lib/prefs";
import { db } from "@/lib/db";
import { isListed } from "@/lib/catalog";
import { readCart } from "@/lib/cart";
import { quote } from "@/lib/pricing";
import { Icon } from "@/components/icons";
import { checkoutCartLine, removeFromCart, setCartQuantity } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await i18n()).t("السلة"), robots: { index: false } };
}

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ line?: string; error?: string }>;
}) {
  const { t, money } = await i18n();
  const { line: errorLine, error } = await searchParams;
  const lines = await readCart();
  const products = lines.length
    ? await db.product.findMany({
        where: { id: { in: lines.map((l) => l.p) } },
        include: {
          seller: true,
          options: { orderBy: { sortOrder: "asc" }, include: { values: true } },
          quantityDiscounts: true,
        },
      })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));

  const rows = lines.map((line) => {
    const p = byId.get(line.p);
    if (!p || !isListed(p)) return { line, p: null, total: 0, choices: [] as string[] };
    const choices: string[] = [];
    const deltas: number[] = [];
    for (const o of p.options) {
      if (o.kind === "select") {
        const v = o.values.find((v) => v.id === line.s[o.id]);
        if (v) {
          deltas.push(v.priceDelta);
          choices.push(`${o.name}: ${v.label}`);
        }
      } else if (line.t[o.id]) choices.push(`${o.name}: ${line.t[o.id]}`);
    }
    let total = 0;
    try {
      total = quote({
        basePrice: p.price,
        optionDeltas: deltas,
        quantity: line.q,
        quantityDiscounts: p.quantityDiscounts,
        commissionBps: 0,
      }).total;
    } catch {
      total = 0;
    }
    return { line, p, total, choices };
  });
  const sum = rows.reduce((a, r) => a + r.total, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Icon name="cart" className="h-7 w-7" />
        {t("السلة")}
      </h1>
      {rows.length === 0 ? (
        <div className="card space-y-3 p-8 text-center">
          <p className="text-slate-500">{t("السلة فاضية.")}</p>
          <Link href="/" className="btn-primary inline-flex">
            {t("ابدأ التسوق")}
          </Link>
        </div>
      ) : (
        <>
          <ul className="card divide-y divide-slate-100">
            {rows.map(({ line, p, total, choices }) => (
              <li key={line.id} className="flex flex-wrap items-center gap-4 p-4">
                {p ? (
                  <>
                    <Link href={`/products/${encodeURIComponent(p.slug)}`} className="shrink-0">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                          <Icon name="bag" />
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Link href={`/products/${encodeURIComponent(p.slug)}`} className="font-bold hover:text-brand-600">
                        {p.title}
                      </Link>
                      <p className="text-xs text-slate-500">{p.seller.storeName}</p>
                      {choices.map((c) => (
                        <p key={c} className="text-xs text-slate-600">{c}</p>
                      ))}
                      {errorLine === line.id && error && (
                        <p role="alert" className="text-sm text-red-700">{t(error)}</p>
                      )}
                    </div>
                    <form action={setCartQuantity.bind(null, line.id)} className="flex items-center gap-1">
                      <label className="sr-only" htmlFor={`q-${line.id}`}>{t("الكمية")}</label>
                      <input
                        id={`q-${line.id}`}
                        name="quantity"
                        type="number"
                        min={p.minQty}
                        max={p.maxQty}
                        defaultValue={line.q}
                        className="input w-20"
                      />
                      <button className="btn border border-slate-200 px-3 text-sm">{t("تحديث")}</button>
                    </form>
                    <span className="w-28 text-end font-bold">{money(total)}</span>
                    <div className="flex w-full gap-2 sm:w-auto">
                      <form action={checkoutCartLine.bind(null, line.id)} className="flex-1">
                        <button className="btn w-full bg-yellow-400 px-4 font-extrabold text-brand-950 hover:bg-yellow-300">
                          {t("اشتري")}
                        </button>
                      </form>
                      <form action={removeFromCart.bind(null, line.id)}>
                        <button className="btn border border-red-200 px-3 text-sm text-red-700 hover:bg-red-50">
                          {t("حذف")}
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="flex-1 text-sm text-slate-500">{t("المنتج ده مبقاش متاح للشراء.")}</p>
                    <form action={removeFromCart.bind(null, line.id)}>
                      <button className="btn border border-red-200 px-3 text-sm text-red-700 hover:bg-red-50">
                        {t("حذف")}
                      </button>
                    </form>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <p className="text-sm text-slate-500">
              {t("كل منتج بيتدفع في طلب لوحده، عشان كل منتج ممكن يكون من تاجر مختلف.")}
            </p>
            <p className="text-lg font-black">
              {t("الإجمالي: ")}{money(sum)}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
