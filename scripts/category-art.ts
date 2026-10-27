// Draws the artwork for every category in prisma/category-tree.ts into
// public/categories/<slug>.svg. Run after adding categories:
//   npx tsx scripts/category-art.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORY_TREE } from "../prisma/category-tree";

// [from, to, ink]: gradient stops and the text colour drawn over them.
const PALETTES: Record<string, [string, string, string]> = {
  games: ["#8b5cf6", "#3b0764", "#ffffff"],
  "gift-cards": ["#fde047", "#f59e0b", "#2e1065"],
  "game-topup": ["#d946ef", "#581c87", "#ffffff"],
  "game-accounts": ["#6366f1", "#1e1b4b", "#ffffff"],
  ai: ["#a78bfa", "#4c1d95", "#ffffff"],
  productivity: ["#818cf8", "#312e81", "#ffffff"],
  design: ["#e879f9", "#86198f", "#ffffff"],
  streaming: ["#9333ea", "#1e1036", "#ffffff"],
  "social-media": ["#c084fc", "#6b21a8", "#ffffff"],
  mobile: ["#7c3aed", "#2e1065", "#ffffff"],
  learning: ["#facc15", "#ca8a04", "#2e1065"],
  vpn: ["#4338ca", "#0f0a2e", "#ffffff"],
};
const FALLBACK: [string, string, string] = ["#7c3aed", "#2e1065", "#ffffff"];

// "Steam games" → "Steam": the brand is the picture, the generic word is in
// the category name under it.
function label(nameEn: string) {
  return nameEn
    .replace(/\b(gift cards|store cards|cards|games|accounts|apps)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function esc(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function art({ icon, text, palette, seed }: { icon: string; text?: string; palette: [string, string, string]; seed: number }) {
  const [from, to, ink] = palette;
  const angle = (seed * 37) % 360;
  const cx = 60 + ((seed * 53) % 280);
  const fontSize = text && text.length > 12 ? 30 : 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle} .5 .5)">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="300" fill="url(#g)"/>
  <circle cx="${cx}" cy="40" r="110" fill="#ffffff" opacity=".10"/>
  <circle cx="${400 - cx}" cy="300" r="90" fill="#facc15" opacity=".18"/>
  <circle cx="340" cy="70" r="26" fill="#ffffff" opacity=".12"/>
  <text x="200" y="${text ? 150 : 175}" font-size="${text ? 96 : 130}" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${icon}</text>
  ${
    text
      ? `<text x="200" y="245" font-size="${fontSize}" font-weight="800" text-anchor="middle" fill="${ink}" font-family="Segoe UI, Arial, Helvetica, sans-serif">${esc(text)}</text>`
      : ""
  }
</svg>
`;
}

const out = join(__dirname, "..", "public", "categories");
let n = 0;
CATEGORY_TREE.forEach((c, i) => {
  const palette = PALETTES[c.slug] ?? FALLBACK;
  writeFileSync(join(out, `${c.slug}.svg`), art({ icon: c.icon, palette, seed: i }));
  n++;
  c.children.forEach((s, j) => {
    writeFileSync(join(out, `${s.slug}.svg`), art({ icon: s.icon, text: label(s.nameEn), palette, seed: i * 7 + j + 1 }));
    n++;
  });
});
console.log(`wrote ${n} images to public/categories`);
