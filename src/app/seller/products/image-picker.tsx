"use client";

import { useState } from "react";

const MAX = 500 * 1024;

// Product photo from the seller's device. The saved photo stays unless the
// seller picks a new one or removes it.
export function ImagePicker({ current }: { current?: string }) {
  const [kept, setKept] = useState(current ?? "");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const shown = preview || kept;
  return (
    <div>
      <span className="label">صورة المنتج (اختياري)</span>
      <input type="hidden" name="imageUrl" value={kept} />
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-24 w-32 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-xs text-slate-400">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            "بدون صورة"
          )}
        </div>
        <div className="space-y-2">
          <input
            type="file"
            name="imageFile"
            accept="image/jpeg,image/png,image/webp"
            className="block text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setError("");
              setPreview("");
              if (!file) return;
              if (file.size > MAX) {
                setError(`حجم الصورة ${Math.ceil(file.size / 1024)}KB، والحد الأقصى 500KB`);
                e.target.value = "";
                return;
              }
              setPreview(URL.createObjectURL(file));
            }}
          />
          <p className="text-xs text-slate-500">JPG أو PNG أو WEBP، حجمها ميزيدش عن 500KB.</p>
          {kept && !preview && (
            <button type="button" className="text-xs text-red-700 underline" onClick={() => setKept("")}>
              شيل الصورة
            </button>
          )}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
