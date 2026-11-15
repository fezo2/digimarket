"use client";

import { useActionState } from "react";
import { useI18n } from "@/components/i18n-provider";
import type { ActionState } from "@/components/action-form";
import { addStoreCategory, manageStoreCategory, setProductStoreCategory } from "./actions";
import { Icon } from "../icons";

export function NewStoreCategoryForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(addStoreCategory, {} as ActionState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input
        className="input max-w-xs flex-1"
        name="name"
        required
        minLength={2}
        maxLength={40}
        placeholder={t("مثلاً: اشتراكات ChatGPT")}
        aria-label={t("اسم التصنيف")}
        key={state.success ? Date.now() : "name"}
      />
      <button className="btn-primary" disabled={pending}>
        <Icon name="plus" className="size-4" />
        {pending ? t("جاري التنفيذ…") : t("إضافة تصنيف")}
      </button>
      {state.error && <p role="alert" className="text-sm text-red-700">{t(state.error)}</p>}
    </form>
  );
}

export function RenameStoreCategory({ id, name }: { id: string; name: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(manageStoreCategory, {} as ActionState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="operation" value="rename" />
      <input
        className="input max-w-64 py-1.5"
        name="name"
        defaultValue={name}
        required
        minLength={2}
        maxLength={40}
        aria-label={t("اسم التصنيف")}
      />
      <button className="btn-outline px-3 py-1.5" disabled={pending}>{t("حفظ")}</button>
      {state.error && <p role="alert" className="text-xs text-red-700">{t(state.error)}</p>}
      {state.success && <p role="status" className="text-xs text-emerald-700">{t(state.success)}</p>}
    </form>
  );
}

export function StoreCategoryButton({
  id,
  operation,
  label,
  className,
  disabled,
  children,
}: {
  id: string;
  operation: "up" | "down" | "delete";
  label: string;
  className: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(manageStoreCategory, {} as ActionState);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (operation === "delete" && !confirm(t("تمسح التصنيف ده؟ المنتجات اللي فيه هتفضل معروضة من غير تصنيف.")))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="operation" value={operation} />
      <button disabled={pending || disabled} className={className} aria-label={label} title={label}>
        {children ?? label}
      </button>
      {state.error && <p role="alert" className="mt-1 text-xs text-red-700">{t(state.error)}</p>}
    </form>
  );
}

// Drop-down in the products table that saves as soon as it changes.
export function ProductStoreCategory({
  productId,
  value,
  categories,
}: {
  productId: string;
  value: string | null;
  categories: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(setProductStoreCategory, {} as ActionState);
  return (
    <form action={action}>
      <input type="hidden" name="productId" value={productId} />
      <select
        name="storeCategoryId"
        aria-label={t("تصنيف المتجر")}
        defaultValue={value ?? ""}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="input w-auto max-w-44 py-1 text-xs"
      >
        <option value="">{t("بدون تصنيف")}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {state.error && <p role="alert" className="mt-1 text-xs text-red-700">{t(state.error)}</p>}
    </form>
  );
}
