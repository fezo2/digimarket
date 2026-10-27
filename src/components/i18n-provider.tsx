"use client";

import { createContext, useContext, useMemo } from "react";
import { toolsFor, type Lang } from "@/lib/i18n";

const LangContext = createContext<Lang>("ar");

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

// Client components: const { t, money } = useI18n();
export function useI18n() {
  const lang = useContext(LangContext);
  return useMemo(() => toolsFor(lang), [lang]);
}
