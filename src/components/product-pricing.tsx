"use client";

import { useI18n } from "@/components/i18n-provider";
import { useActionState, useState } from "react";

import { quote } from "@/lib/pricing";
import { buyProduct } from "@/app/(store)/products/[slug]/actions";

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
        <span className="text-2xl font-extrabold text-brand-700">
          {money(unitPrice)}
        </span>
        {compareAtPrice !== null && compareAtPrice > unitPrice && (
          <span className="text-slate-400 line-through">
            {money(compareAtPrice)}
          </span>
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
      <button
        className="btn-primary w-full"
        disabled={!inStock || pending || !pricing}
      >
        {!inStock ? t("نفذت الكمية") : pending ? t("بنحجز طلبك…") : t("اشتري دلوقتي")}
      </button>
    </form>
  );
}
