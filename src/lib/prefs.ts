import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { toolsFor, type Lang, type Theme } from "./i18n";

export const LANG_COOKIE = "dm_lang";
export const THEME_COOKIE = "dm_theme";

// The visitor's language and theme, from cookies set by the header toggles.
export const getPrefs = cache(async () => {
  const jar = await cookies();
  const lang: Lang = jar.get(LANG_COOKIE)?.value === "en" ? "en" : "ar";
  const theme: Theme = jar.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
  return { lang, theme };
});

// Server components: const { t, money, date } = await i18n();
export async function i18n() {
  return toolsFor((await getPrefs()).lang);
}
