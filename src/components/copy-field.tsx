"use client";
import { useI18n } from "@/components/i18n-provider";
import { useState } from "react";

// A read-only link with a copy button (affiliate links).
export function CopyField({ value, label }: { value: string; label?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-stretch gap-2">
      <input
        className="input min-w-0 flex-1 text-xs"
        dir="ltr"
        readOnly
        value={value}
        aria-label={label ?? t("اللينك")}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button
        type="button"
        className="btn-outline shrink-0 px-3 text-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? t("اتنسخ") : t("نسخ")}
      </button>
    </div>
  );
}
