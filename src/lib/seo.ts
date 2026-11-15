import { SITE_NAME, SITE_NAME_EN } from "./config";

// Absolute store origin for canonical links, sitemaps and share cards.
export function storeOrigin() {
  try {
    return new URL(process.env.APP_URL || "http://localhost:3000").origin;
  } catch {
    return "http://localhost:3000";
  }
}

export const absolute = (path: string) => storeOrigin() + path;

// Image paths like /img/… made absolute for structured data and sitemaps.
export const absoluteUrl = (url: string) => (/^https?:\/\//.test(url) ? url : absolute(url));

// The English version of a store URL: the same page with ?lang=en.
export function englishPath(path: string) {
  return path + (path.includes("?") ? "&" : "?") + "lang=en";
}

// canonical + hreflang for a page served in Arabic (default) and English.
// Each language version is its own canonical, and both point at each other.
export function localized(path: string, lang: "ar" | "en") {
  const en = englishPath(path);
  return {
    canonical: lang === "en" ? en : path,
    languages: { "ar-EG": path, en, "x-default": path },
  };
}

export const BRAND = `${SITE_NAME} ${SITE_NAME_EN}`;

// Meta descriptions: one line, cut on a word near 155 characters.
export function describe(text: string, max = 155) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : max) + "…";
}

// JSON for a <script type="application/ld+json">, safe to inline in HTML.
export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
