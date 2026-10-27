"use server";

import { cookies } from "next/headers";
import { LANG_COOKIE, THEME_COOKIE } from "@/lib/prefs";

const YEAR = 60 * 60 * 24 * 365;

export async function setPreference(name: "lang" | "theme", value: string) {
  const ok = name === "lang" ? ["ar", "en"].includes(value) : ["light", "dark"].includes(value);
  if (!ok) return;
  (await cookies()).set(name === "lang" ? LANG_COOKIE : THEME_COOKIE, value, {
    path: "/",
    maxAge: YEAR,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
