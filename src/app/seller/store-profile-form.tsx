"use client";

import { useActionState } from "react";
import { updateStoreProfile } from "./actions";

type Defaults = { description: string; businessHours: string };

export function StoreProfileForm({ defaults }: { defaults: Defaults }) {
  const [state, action, pending] = useActionState(
    updateStoreProfile,
    undefined,
  );
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="description">
          وصف المتجر
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={defaults.description}
          className="input"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="businessHours">
            ساعات العمل
          </label>
          <input
            id="businessHours"
            name="businessHours"
            placeholder="مثلاً: يومياً من 10 ص لـ 12 م"
            defaultValue={defaults.businessHours}
            className="input"
          />
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state && !state.error && (
        <p className="text-sm text-emerald-700">اتحفظ ✓</p>
      )}
      <button disabled={pending} className="btn-primary">
        حفظ
      </button>
    </form>
  );
}
