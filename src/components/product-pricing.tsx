"use client";

import { useState } from "react";
import { formatEGP } from "@/lib/money";

type Props = {
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

export function ProductPricing({
  price,
  compareAtPrice,
  minQty,
  maxQty,
  inStock,
  options,
  discounts,
}: Props) {
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      options
        .filter((o) => o.kind === "select")
        .map((o) => [o.id, o.required ? (o.values[0]?.id ?? "") : ""]),
    ),
  );
  const [quantity, setQuantity] = useState(minQty);
  const unitPrice =
    price +
    options.reduce(
      (sum, o) =>
        sum + (o.values.find((v) => v.id === selected[o.id])?.priceDelta ?? 0),
      0,
    );
  const discount =
    discounts
      .filter((d) => d.minQty <= quantity)
      .sort((a, b) => b.minQty - a.minQty)[0]?.percentOff ?? 0;
  const total = Math.round((unitPrice * quantity * (100 - discount)) / 100);
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3" aria-live="polite">
        <span className="text-2xl font-extrabold text-brand-700">
          {formatEGP(unitPrice)}
        </span>
        {compareAtPrice !== null && compareAtPrice > unitPrice && (
          <span className="text-slate-400 line-through">
            {formatEGP(compareAtPrice)}
          </span>
        )}
      </div>
      {options.map((o) => (
        <div key={o.id}>
          <label className="label" htmlFor={`option-${o.id}`}>
            {o.name}
            {o.required ? " *" : " (اختياري)"}
          </label>
          {o.kind === "select" ? (
            <select
              id={`option-${o.id}`}
              className="input"
              disabled={!inStock}
              required={o.required}
              value={selected[o.id] ?? ""}
              onChange={(e) =>
                setSelected({ ...selected, [o.id]: e.target.value })
              }
            >
              {!o.required && <option value="">بدون اختيار</option>}
              {o.values.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                  {v.priceDelta !== 0 &&
                    ` (${v.priceDelta > 0 ? "+" : ""}${formatEGP(v.priceDelta)})`}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`option-${o.id}`}
              className="input"
              required={o.required}
              disabled={!inStock}
            />
          )}
        </div>
      ))}
      <div>
        <label className="label" htmlFor="quantity">
          الكمية
        </label>
        <input
          id="quantity"
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
      {discounts.length > 0 && (
        <ul className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          {discounts.map((d) => (
            <li key={d.minQty}>
              اشتري {d.minQty} أو أكتر ووفّر {d.percentOff}%
            </li>
          ))}
        </ul>
      )}
      <p aria-live="polite" className="font-bold">
        الإجمالي: {formatEGP(total)}
        {discount > 0 && (
          <span className="ms-2 text-emerald-700">خصم {discount}% مطبّق</span>
        )}
      </p>
    </div>
  );
}
