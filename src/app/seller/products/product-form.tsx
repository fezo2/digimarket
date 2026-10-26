"use client";

import { useActionState, useState, useRef } from "react";
import { prepareUploads } from "@/lib/upload-form";
import { saveProduct, type State } from "./actions";
import { deliveryLabels } from "@/lib/product-input";

type Option = {
  name: string;
  kind: "select" | "text";
  required: boolean;
  values: { label: string; priceDelta: string }[];
};
type Discount = { minQty: number; percentOff: number };
export type Defaults = {
  id: string;
  title: string;
  categoryId: string;
  description: string;
  imageUrl: string;
  price: string;
  compareAtPrice: string;
  deliveryType: keyof typeof deliveryLabels;
  deliveryContent: string;
  hasFile: boolean;
  instructions: string;
  minQty: number;
  maxQty: number;
  options: Option[];
  discounts: Discount[];
};

export function ProductForm({
  categories,
  defaults,
}: {
  categories: { id: string; nameAr: string; parentId: string | null }[];
  defaults?: Defaults;
}) {
  const intentRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(
    async (state: State, form: FormData) => {
      try {
        await prepareUploads(
          form,
          "product",
          ["deliveryFile"],
          defaults?.id ?? "",
        );
      } catch {
        return { error: "رفع الملف فشل، جرّب تاني" };
      }
      return saveProduct(state, form);
    },
    undefined,
  );
  const [type, setType] = useState(defaults?.deliveryType ?? "UNIQUE_CODES");
  const [options, setOptions] = useState<Option[]>(defaults?.options ?? []);
  const [discounts, setDiscounts] = useState<Discount[]>(
    defaults?.discounts ?? [],
  );
  const updateOption = (i: number, value: Partial<Option>) =>
    setOptions((items) =>
      items.map((o, n) => (n === i ? { ...o, ...value } : o)),
    );
  return (
    <form action={action} className="card space-y-5 p-6">
      <input ref={intentRef} type="hidden" name="intent" defaultValue="DRAFT" />
      <input type="hidden" name="id" value={defaults?.id ?? ""} />
      <input type="hidden" name="options" value={JSON.stringify(options)} />
      <input type="hidden" name="discounts" value={JSON.stringify(discounts)} />
      <div>
        <label className="label" htmlFor="title">
          اسم المنتج
        </label>
        <input
          id="title"
          name="title"
          className="input"
          required
          minLength={3}
          maxLength={160}
          defaultValue={defaults?.title}
        />
      </div>
      <div>
        <label className="label" htmlFor="categoryId">
          القسم
        </label>
        <select
          id="categoryId"
          name="categoryId"
          className="input"
          required
          defaultValue={defaults?.categoryId ?? ""}
        >
          <option value="">اختار القسم</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.parentId
                ? `${categories.find((p) => p.id === c.parentId)?.nameAr ?? ""} / `
                : ""}
              {c.nameAr}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="description">
          الوصف
        </label>
        <textarea
          id="description"
          name="description"
          className="input"
          rows={6}
          required
          minLength={10}
          defaultValue={defaults?.description}
        />
      </div>
      <div>
        <label className="label" htmlFor="imageUrl">
          رابط صورة المنتج (اختياري)
        </label>
        <input
          id="imageUrl"
          name="imageUrl"
          type="url"
          className="input"
          dir="ltr"
          defaultValue={defaults?.imageUrl}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="price">
            السعر بالجنيه
          </label>
          <input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="1"
            required
            className="input"
            defaultValue={defaults?.price}
          />
        </div>
        <div>
          <label className="label" htmlFor="compareAtPrice">
            السعر قبل الخصم (اختياري)
          </label>
          <input
            id="compareAtPrice"
            name="compareAtPrice"
            type="number"
            step="0.01"
            min="1"
            className="input"
            defaultValue={defaults?.compareAtPrice}
          />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="label">طريقة التسليم</legend>
        {Object.entries(deliveryLabels).map(([key, label]) => (
          <label className="flex gap-2" key={key}>
            <input
              type="radio"
              name="deliveryType"
              value={key}
              checked={type === key}
              onChange={() => setType(key as typeof type)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {type === "FILE" ? (
        <div>
          <label className="label" htmlFor="deliveryFile">
            ملف التسليم — ZIP أو PDF أو صورة، بحد أقصى 50 ميجا
          </label>
          <input
            id="deliveryFile"
            name="deliveryFile"
            type="file"
            className="input"
            accept=".zip,.pdf,.jpg,.jpeg,.png,.webp"
            required={!defaults?.hasFile}
          />
          {defaults?.hasFile && (
            <p className="text-sm text-slate-500">
              في ملف محفوظ؛ ارفع ملف جديد لو عايز تستبدله.
            </p>
          )}
          <input type="hidden" name="deliveryContent" value="" />
        </div>
      ) : type === "UNIQUE_CODES" ? (
        <>
          <p className="text-sm text-slate-500">
            احفظ المنتج وبعدين افتح صفحة الأكواد لإضافة المخزون.
          </p>
          <input type="hidden" name="deliveryContent" value="" />
        </>
      ) : (
        <div>
          <label className="label" htmlFor="deliveryContent">
            محتوى التسليم (بيظهر بعد الشراء فقط)
          </label>
          <textarea
            id="deliveryContent"
            name="deliveryContent"
            className="input"
            rows={4}
            required
            defaultValue={defaults?.deliveryContent}
          />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="minQty">
            أقل كمية
          </label>
          <input
            id="minQty"
            name="minQty"
            type="number"
            min={1}
            max={10000}
            required
            className="input"
            defaultValue={defaults?.minQty ?? 1}
          />
        </div>
        <div>
          <label className="label" htmlFor="maxQty">
            أقصى كمية
          </label>
          <input
            id="maxQty"
            name="maxQty"
            type="number"
            min={1}
            max={10000}
            required
            className="input"
            defaultValue={defaults?.maxQty ?? 10}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="instructions">
          تعليمات للمشتري بعد الشراء
        </label>
        <textarea
          id="instructions"
          name="instructions"
          className="input"
          rows={3}
          defaultValue={defaults?.instructions}
        />
      </div>
      <section className="space-y-4">
        <h2 className="font-bold">اختيارات المنتج</h2>
        {options.map((o, i) => (
          <fieldset key={i} className="space-y-3 rounded-xl border p-4">
            <legend>اختيار {i + 1}</legend>
            <label className="label">
              اسم الاختيار
              <input
                aria-label={`اسم الاختيار ${i + 1}`}
                required
                className="input"
                value={o.name}
                onChange={(e) => updateOption(i, { name: e.target.value })}
              />
            </label>
            <label className="label">
              النوع
              <select
                className="input"
                value={o.kind}
                onChange={(e) =>
                  updateOption(i, { kind: e.target.value as Option["kind"] })
                }
              >
                <option value="select">قائمة اختيارات</option>
                <option value="text">نص يكتبه المشتري</option>
              </select>
            </label>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={o.required}
                onChange={(e) =>
                  updateOption(i, { required: e.target.checked })
                }
              />
              مطلوب
            </label>
            {o.kind === "select" && (
              <>
                {o.values.map((v, j) => (
                  <div key={j} className="flex flex-wrap gap-2">
                    <input
                      aria-label={`قيمة ${j + 1} للاختيار ${i + 1}`}
                      placeholder="اسم القيمة"
                      required
                      className="input flex-1"
                      value={v.label}
                      onChange={(e) =>
                        updateOption(i, {
                          values: o.values.map((x, n) =>
                            n === j ? { ...x, label: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <input
                      aria-label={`فرق السعر للقيمة ${j + 1}`}
                      placeholder="فرق السعر بالجنيه"
                      type="number"
                      step="0.01"
                      required
                      className="input flex-1"
                      value={v.priceDelta}
                      onChange={(e) =>
                        updateOption(i, {
                          values: o.values.map((x, n) =>
                            n === j ? { ...x, priceDelta: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() =>
                        updateOption(i, {
                          values: o.values.filter((_, n) => n !== j),
                        })
                      }
                    >
                      حذف القيمة
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() =>
                    updateOption(i, {
                      values: [...o.values, { label: "", priceDelta: "0" }],
                    })
                  }
                >
                  إضافة قيمة
                </button>
              </>
            )}
            <button
              type="button"
              className="btn-danger"
              onClick={() => setOptions(options.filter((_, n) => n !== i))}
            >
              حذف الاختيار
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="btn-outline"
          onClick={() =>
            setOptions([
              ...options,
              {
                name: "",
                kind: "select",
                required: true,
                values: [{ label: "", priceDelta: "0" }],
              },
            ])
          }
        >
          إضافة اختيار
        </button>
      </section>
      <section className="space-y-3">
        <h2 className="font-bold">خصومات الكمية</h2>
        {discounts.map((d, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <label className="label flex-1">
              الكمية
              <input
                aria-label={`كمية الخصم ${i + 1}`}
                className="input"
                type="number"
                min={2}
                required
                value={d.minQty}
                onChange={(e) =>
                  setDiscounts(
                    discounts.map((x, n) =>
                      n === i ? { ...x, minQty: Number(e.target.value) } : x,
                    ),
                  )
                }
              />
            </label>
            <label className="label flex-1">
              الخصم %
              <input
                aria-label={`نسبة الخصم ${i + 1}`}
                className="input"
                type="number"
                min={1}
                max={90}
                required
                value={d.percentOff}
                onChange={(e) =>
                  setDiscounts(
                    discounts.map((x, n) =>
                      n === i
                        ? { ...x, percentOff: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              className="btn-danger"
              onClick={() => setDiscounts(discounts.filter((_, n) => n !== i))}
            >
              حذف الخصم
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-outline"
          onClick={() =>
            setDiscounts([...discounts, { minQty: 2, percentOff: 5 }])
          }
        >
          إضافة خصم كمية
        </button>
      </section>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          disabled={pending}
          onClick={() => {
            if (intentRef.current) intentRef.current.value = "DRAFT";
          }}
          className="btn-outline"
        >
          حفظ كمسودة
        </button>
        <button
          disabled={pending}
          onClick={() => {
            if (intentRef.current) intentRef.current.value = "PENDING_REVIEW";
          }}
          className="btn-primary"
        >
          {pending ? "بيتحفظ…" : "إرسال للمراجعة"}
        </button>
      </div>
      <p className="text-sm text-slate-500">
        تعديل البيانات الأساسية لمنتج نشط بيرجّعه للمراجعة.
      </p>
    </form>
  );
}
