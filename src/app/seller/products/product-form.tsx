"use client";

import { useI18n } from "@/components/i18n-provider";
import { useActionState, useState, useRef } from "react";
import { prepareUploads } from "@/lib/upload-form";
import { saveProduct, type State } from "./actions";
import { deliveryLabels } from "@/lib/product-input";
import { ImagePicker } from "./image-picker";

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
  categories: { id: string; nameAr: string; nameEn: string; parentId: string | null }[];
  defaults?: Defaults;
}) {
  const { t, cat } = useI18n();
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
        return { error: t("رفع الملف فشل، جرّب تاني") };
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
          {t("اسم المنتج")}
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
          {t("القسم")}
        </label>
        <select
          id="categoryId"
          name="categoryId"
          className="input"
          required
          defaultValue={defaults?.categoryId ?? ""}
        >
          <option value="">{t("اختار القسم")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.parentId
                ? `${cat(categories.find((p) => p.id === c.parentId) ?? { nameAr: "" })} / `
                : ""}
              {cat(c)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="description">
          {t("الوصف")}
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
      <ImagePicker current={defaults?.imageUrl} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="price">
            {t("السعر بالجنيه")}
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
            {t("السعر قبل الخصم (اختياري)")}
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
        <legend className="label">{t("طريقة التسليم")}</legend>
        {Object.entries(deliveryLabels).map(([key, label]) => (
          <label className="flex gap-2" key={key}>
            <input
              type="radio"
              name="deliveryType"
              value={key}
              checked={type === key}
              onChange={() => setType(key as typeof type)}
            />
            {t(label)}
          </label>
        ))}
      </fieldset>
      {type === "FILE" ? (
        <div>
          <label className="label" htmlFor="deliveryFile">
            {t("ملف التسليم — ZIP أو PDF أو صورة، بحد أقصى 50 ميجا")}
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
              {t("في ملف محفوظ؛ ارفع ملف جديد لو عايز تستبدله.")}
            </p>
          )}
          <input type="hidden" name="deliveryContent" value="" />
        </div>
      ) : type === "UNIQUE_CODES" ? (
        <>
          <p className="text-sm text-slate-500">
            {t("احفظ المنتج وبعدين افتح صفحة الأكواد لإضافة المخزون.")}
          </p>
          <input type="hidden" name="deliveryContent" value="" />
        </>
      ) : (
        <div>
          <label className="label" htmlFor="deliveryContent">
            {t("محتوى التسليم (بيظهر بعد الشراء فقط)")}
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
            {t("أقل كمية")}
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
            {t("أقصى كمية")}
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
          {t("تعليمات للمشتري بعد الشراء")}
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
        <h2 className="font-bold">{t("اختيارات المنتج")}</h2>
        {options.map((o, i) => (
          <fieldset key={i} className="space-y-3 rounded-xl border p-4">
            <legend>{t("اختيار ")}{i + 1}</legend>
            <label className="label">
              {t("اسم الاختيار")}
              <input
                aria-label={t("اسم الاختيار {i}", { i: i + 1 })}
                required
                className="input"
                value={o.name}
                onChange={(e) => updateOption(i, { name: e.target.value })}
              />
            </label>
            <label className="label">
              {t("النوع")}
              <select
                className="input"
                value={o.kind}
                onChange={(e) =>
                  updateOption(i, { kind: e.target.value as Option["kind"] })
                }
              >
                <option value="select">{t("قائمة اختيارات")}</option>
                <option value="text">{t("نص يكتبه المشتري")}</option>
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
              {t("مطلوب")}
            </label>
            {o.kind === "select" && (
              <>
                {o.values.map((v, j) => (
                  <div key={j} className="flex flex-wrap gap-2">
                    <input
                      aria-label={t("قيمة {j} للاختيار {i}", { j: j + 1, i: i + 1 })}
                      placeholder={t("اسم القيمة")}
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
                      aria-label={t("فرق السعر للقيمة {j}", { j: j + 1 })}
                      placeholder={t("فرق السعر بالجنيه")}
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
                      {t("حذف القيمة")}
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
                  {t("إضافة قيمة")}
                </button>
              </>
            )}
            <button
              type="button"
              className="btn-danger"
              onClick={() => setOptions(options.filter((_, n) => n !== i))}
            >
              {t("حذف الاختيار")}
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
          {t("إضافة اختيار")}
        </button>
      </section>
      <section className="space-y-3">
        <h2 className="font-bold">{t("خصومات الكمية")}</h2>
        {discounts.map((d, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <label className="label flex-1">
              {t("الكمية")}
              <input
                aria-label={t("كمية الخصم {i}", { i: i + 1 })}
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
              {t("الخصم %")}
              <input
                aria-label={t("نسبة الخصم {i}", { i: i + 1 })}
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
              {t("حذف الخصم")}
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
          {t("إضافة خصم كمية")}
        </button>
      </section>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
          {t(state.error)}
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
          {t("حفظ كمسودة")}
        </button>
        <button
          disabled={pending}
          onClick={() => {
            if (intentRef.current) intentRef.current.value = "PENDING_REVIEW";
          }}
          className="btn-primary"
        >
          {pending ? t("بيتحفظ…") : t("إرسال للمراجعة")}
        </button>
      </div>
      <p className="text-sm text-slate-500">
        {t("تعديل البيانات الأساسية لمنتج نشط بيرجّعه للمراجعة.")}
      </p>
    </form>
  );
}
