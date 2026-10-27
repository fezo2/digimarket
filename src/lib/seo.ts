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
