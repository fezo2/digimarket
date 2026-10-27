import { en as base } from "@/i18n/en";
import { enSeller } from "@/i18n/en-seller";

// The seller portal keeps its strings in their own file.
export const en: Record<string, string> = { ...base, ...enSeller };

// Arabic is the source language: every UI string is written in Arabic and
// looked up in the English dictionary by that exact text. Anything missing
// from the dictionary shows in Arabic, so nothing ever renders blank.
export type Lang = "ar" | "en";
export type Theme = "light" | "dark";
export const LANGS: Lang[] = ["ar", "en"];

type Vars = Record<string, string | number>;

export function translate(lang: Lang, text: string, vars?: Vars) {
  let out = lang === "en" ? (en[text] ?? text) : text;
  if (vars)
    for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

const numbers = {
  ar: new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }),
  en: new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }),
};

const TZ = "Africa/Cairo";

export function toolsFor(lang: Lang) {
  const loc = lang === "en" ? "en-GB" : "ar-EG";
  return {
    lang,
    dir: lang === "en" ? ("ltr" as const) : ("rtl" as const),
    t: (text: string, vars?: Vars) => translate(lang, text, vars),
    num: (n: number) => numbers[lang].format(n),
    money: (piasters: number) =>
      lang === "en"
        ? `EGP ${numbers.en.format(piasters / 100)}`
        : `${numbers.ar.format(piasters / 100)} ج.م`,
    // Category names are stored in both languages.
    cat: (c: { nameAr: string; nameEn?: string | null }) =>
      lang === "en" && c.nameEn ? c.nameEn : c.nameAr,
    // Servers run in UTC; buyers and sellers read Cairo time.
    date: (d: Date | string | number) => new Date(d).toLocaleString(loc, { timeZone: TZ }),
    day: (d: Date | string | number) => new Date(d).toLocaleDateString(loc, { timeZone: TZ }),
    time: (d: Date | string | number) =>
      new Date(d).toLocaleTimeString(loc, { timeZone: TZ, hour: "numeric", minute: "2-digit" }),
  };
}
export type I18n = ReturnType<typeof toolsFor>;
