"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setPreference } from "@/app/prefs-actions";
import { useI18n } from "./i18n-provider";
import type { Theme } from "@/lib/i18n";

// Language and dark-mode switches shown in every header.
export function PrefsToggle({ theme, tone = "light" }: { theme: Theme; tone?: "light" | "dark" }) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (name: "lang" | "theme", value: string) =>
    start(async () => {
      await setPreference(name, value);
      if (name === "theme") document.documentElement.classList.toggle("dark", value === "dark");
      router.refresh();
    });
  const cls =
    tone === "dark"
      ? "rounded-lg px-2 py-1 text-slate-300 hover:bg-white/10 hover:text-white"
      : "rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100";
  const themeLabel = theme === "dark" ? t("الوضع النهاري") : t("الوضع الليلي");
  return (
    <div className="flex items-center gap-1 text-sm" aria-busy={pending}>
      <button
        type="button"
        className={cls}
        onClick={() => set("lang", lang === "ar" ? "en" : "ar")}
        title={t("تغيير اللغة")}
      >
        {lang === "ar" ? "EN" : "ع"}
      </button>
      <button
        type="button"
        className={cls}
        onClick={() => set("theme", theme === "dark" ? "light" : "dark")}
        title={themeLabel}
        aria-label={themeLabel}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
    </div>
  );
}
