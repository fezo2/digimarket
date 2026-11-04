"use client";

import { useI18n } from "@/components/i18n-provider";
import Link from "next/link";
import { useActionState, useState } from "react";

import { quote } from "@/lib/pricing";
import { addToCart, buyProduct } from "@/app/(store)/products/[slug]/actions";

type Props = {
  productId: string;
  slug: string;
  price: number;
  compareAtPrice: number | null;
  minQty: number;
  maxQty: number;
  inStock: boolean;
  options: {
    id: string;
    name: string;
    kind: string;
    required: boolean;
    values: { id: string; label: string; priceDelta: number }[];
  }[];
  discounts: { minQty: number; percentOff: number }[];
};

export function BuyBox({
  productId,
  slug,
  price,
  compareAtPrice,
  minQty,
  maxQty,
  inStock,
  options,
  discounts,
}: Props) {
  const { t, money } = useI18n();
  const [state, action, pending] = useActionState(
    buyProduct.bind(null, productId, slug),
    undefined,
  );
  const [cartState, cartAction, adding] = useActionState(
    addToCart.bind(null, productId),
    undefined,
  );
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      options
        .filter((o) => o.kind === "select")
        .map((o) => [o.id, o.required ? (o.values[0]?.id ?? "") : ""]),
    ),
  );
  const [quantity, setQuantity] = useState(minQty);
  let pricing: ReturnType<typeof quote> | undefined;
  let pricingError = "";
  try {
    pricing = quote({
      basePrice: price,
      optionDeltas: options.map(
        (o) => o.values.find((v) => v.id === selected[o.id])?.priceDelta ?? 0,
      ),
      quantity,
      quantityDiscounts: discounts,
      commissionBps: 0,
    });
  } catch {
    pricingError =
      t("قيمة الطلب أو الاختيارات مش صالحة. قلّل الكمية أو راجع الاختيارات.");
  }
  const { unitPrice, quantityDiscount, total } = pricing ?? {
    unitPrice: price,
    quantityDiscount: 0,
    total: 0,
  };
  return (
    <form action={action} className="space-y-4">
      <div className="flex items-baseline gap-3" aria-live="polite">
        <span className="text-3xl font-black">
          {money(unitPrice)}
        </span>
        {compareAtPrice !== null && compareAtPrice > unitPrice && (
          <>
            <span className="text-slate-400 line-through">
              {money(compareAtPrice)}
            </span>
            <span className="badge bg-yellow-400 font-extrabold text-brand-950">
              -{Math.round(100 - (unitPrice / compareAtPrice) * 100)}%
            </span>
          </>
        )}
      </div>
      {options.map((o) => (
        <div key={o.id}>
          <label className="label" htmlFor={`option-${o.id}`}>
            {o.name}
            {o.required ? " *" : t(" (اختياري)")}
          </label>
          {o.kind === "select" ? (
            <select
              id={`option-${o.id}`}
              name={`${o.kind === "select" ? "select" : "text"}:${o.id}`}
              className="input"
              disabled={!inStock}
              required={o.required}
              value={selected[o.id] ?? ""}
              onChange={(e) =>
                setSelected({ ...selected, [o.id]: e.target.value })
              }
            >
              {!o.required && <option value="">{t("بدون اختيار")}</option>}
              {o.values.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                  {v.priceDelta !== 0 &&
                    ` (${v.priceDelta > 0 ? "+" : ""}${money(v.priceDelta)})`}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`option-${o.id}`}
              name={`${o.kind === "select" ? "select" : "text"}:${o.id}`}
              className="input"
              required={o.required}
              disabled={!inStock}
            />
          )}
        </div>
      ))}
      <div>
        <label className="label" htmlFor="quantity">
          {t("الكمية")}
        </label>
        <input
          id="quantity"
          name="quantity"
          className="input"
          type="number"
          min={minQty}
          max={maxQty}
          disabled={!inStock}
          value={quantity}
          onChange={(e) => {
            const n = Number(e.target.value);
            setQuantity(
              Math.max(
                minQty,
                Math.min(maxQty, Number.isFinite(n) ? Math.trunc(n) : minQty),
              ),
            );
          }}
        />
      </div>
      {quantityDiscount > 0 && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          {t("خصم الكمية المطبّق: ")}{money(quantityDiscount)}
        </p>
      )}
      <p aria-live="polite" className="font-bold">
        {t("الإجمالي: ")}{pricing ? money(total) : "—"}
      </p>
      {pricingError && (
        <p role="alert" className="text-red-700">
          {pricingError}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-red-700">
          {t(state.error)}
        </p>
      )}
      {cartState?.error && (
        <p role="alert" className="text-red-700">
          {t(cartState.error)}
        </p>
      )}
      {cartState?.added && !adding && (
        <p role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          {t("المنتج اتضاف للسلة")}
          <Link href="/cart" className="font-bold underline">
            {t("روح للسلة")}
          </Link>
        </p>
      )}
      <button
        className="btn w-full bg-yellow-400 py-3.5 text-base font-extrabold text-brand-950 shadow-sm hover:bg-yellow-300"
        disabled={!inStock || pending || adding || !pricing}
      >
        {!inStock ? t("نفذت الكمية") : pending ? t("بنحجز طلبك…") : t("اشتري دلوقتي")}
      </button>
      {inStock && (
        <button
          formAction={cartAction}
          className="btn w-full border-2 border-brand-600 py-3 text-base font-bold text-brand-700 hover:bg-brand-50"
          disabled={pending || adding || !pricing}
        >
          {adding ? t("بنضيفه للسلة…") : t("أضف للسلة")}
        </button>
      )}
    </form>
  );
}
