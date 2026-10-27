import { Prisma } from "@prisma/client";
import { db } from "./db";

// Arabic is written many ways for the same word: أ/إ/آ/ا, ى/ي, ة/ه, with or
// without diacritics and tatweel. Both the query and the catalog are folded
// to one spelling before matching, in JS here and in SQL below.
export function normalizeArabic(text: string) {
  return text
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^\p{L}\p{N}+.#]+/gu, " ")
    .trim();
}

// What buyers type in Arabic → the name sellers put in product titles.
// Keys are already normalized; multi-word keys are matched as phrases first.
const SYNONYMS: Record<string, string[]> = {
  "شات جي بي تي": ["chatgpt", "gpt"],
  "شات جبت": ["chatgpt", "gpt"],
  "تشات جي بي تي": ["chatgpt", "gpt"],
  "جي بي تي": ["gpt", "chatgpt"],
  "كاب كات": ["capcut"],
  "كابكات": ["capcut"],
  "جيميني": ["gemini"],
  "جيمناي": ["gemini"],
  "اوفيس": ["office", "microsoft 365"],
  "مايكروسوفت": ["microsoft"],
  "ويندوز": ["windows"],
  "كانفا": ["canva"],
  "نتفلكس": ["netflix"],
  "نتفليكس": ["netflix"],
  "شاهد": ["shahid"],
  "سبوتيفاي": ["spotify"],
  "يوتيوب": ["youtube"],
  "ادوبي": ["adobe"],
  "فوتوشوب": ["photoshop"],
  "كلود": ["claude"],
  "ميدجورني": ["midjourney"],
  "كوبايلوت": ["copilot"],
  "كورسيرا": ["coursera"],
  "يوديمي": ["udemy"],
  "لينكدان": ["linkedin"],
  "في بي ان": ["vpn"],
  "نورد": ["nord"],
  "اكسبريس": ["express"],
  "بلايستيشن": ["playstation", "psn"],
  "اكس بوكس": ["xbox"],
  "ستيم": ["steam"],
  "ببجي": ["pubg"],
  "فري فاير": ["free fire"],
  "اشتراك": ["subscription"],
  "حساب": ["account"],
  "شهر": ["month"],
  "سنه": ["year"],
  "برو": ["pro"],
  "بلس": ["plus"],
};

const PHRASES = Object.keys(SYNONYMS).sort((a, b) => b.length - a.length);

// Each group is one thing the buyer asked for; a product must match every
// group, and any spelling inside a group counts.
export function queryGroups(raw: string): string[][] {
  let text = ` ${normalizeArabic(raw)} `;
  const groups: string[][] = [];
  for (const phrase of PHRASES) {
    if (!phrase.includes(" ")) continue;
    const at = ` ${phrase} `;
    if (text.includes(at)) {
      groups.push([phrase, ...SYNONYMS[phrase]]);
      text = text.split(at).join(" ");
    }
  }
  for (const word of text.split(" ")) {
    if (!word) continue;
    // "ال" is a prefix in Arabic: "الكورسات" should find "كورسات".
    const bare = word.length > 4 && word.startsWith("ال") ? word.slice(2) : word;
    groups.push([...new Set([bare, ...(SYNONYMS[bare] ?? []), ...(SYNONYMS[word] ?? [])])]);
  }
  return groups.slice(0, 8);
}

// Postgres twin of normalizeArabic for the catalog side.
const fold = (col: Prisma.Sql) =>
  Prisma.sql`translate(regexp_replace(lower(${col}), '[ً-ٰٟـ]', '', 'g'), 'أإآٱىةؤئ', 'اااايهوي')`;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export const SEARCH_SORTS = {
  relevance: "الأنسب",
  popular: "الأكثر مبيعاً",
  newest: "الأحدث",
  "price-asc": "الأرخص",
  "price-desc": "الأغلى",
} as const;
export type SearchSort = keyof typeof SEARCH_SORTS;

// Returns listed product ids, best match first. Title hits outrank hits in
// the description, category or store name; sales break ties.
export async function searchProductIds(opts: {
  q: string;
  categoryIds?: string[];
  sort?: SearchSort;
  limit?: number;
}): Promise<string[]> {
  const groups = queryGroups(opts.q);
  if (groups.length === 0) return [];

  const title = fold(Prisma.sql`p."title"`);
  const hay = fold(
    Prisma.sql`p."title" || ' ' || p."description" || ' ' || c."nameAr" || ' ' || c."nameEn" || ' ' || s."storeName"`,
  );
  const like = (t: string) => `%${escapeLike(t)}%`;
  const any = (expr: Prisma.Sql, terms: string[]) =>
    Prisma.join(
      terms.map((t) => Prisma.sql`${expr} LIKE ${like(t)}`),
      " OR ",
    );

  const matchAll = Prisma.join(
    groups.map((g) => Prisma.sql`(${any(hay, g)})`),
    " AND ",
  );
  const titleScore = Prisma.join(
    groups.map((g) => Prisma.sql`(CASE WHEN ${any(title, g)} THEN 1 ELSE 0 END)`),
    " + ",
  );
  const phrase = normalizeArabic(opts.q);
  const order = {
    relevance: Prisma.sql`score DESC, (${title} LIKE ${like(phrase)}) DESC, p."soldCount" DESC`,
    popular: Prisma.sql`p."soldCount" DESC`,
    newest: Prisma.sql`p."createdAt" DESC`,
    "price-asc": Prisma.sql`p."price" ASC`,
    "price-desc": Prisma.sql`p."price" DESC`,
  }[opts.sort ?? "relevance"];
  const inCategory = opts.categoryIds?.length
    ? Prisma.sql`AND p."categoryId" IN (${Prisma.join(opts.categoryIds)})`
    : Prisma.empty;

  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT p."id", (${titleScore}) AS score
    FROM "Product" p
    JOIN "Category" c ON c."id" = p."categoryId"
    JOIN "SellerProfile" s ON s."id" = p."sellerId"
    WHERE p."status" = 'ACTIVE' AND p."salesEnabled" = true
      AND s."kycStatus" = 'APPROVED' AND s."salesSuspendedAt" IS NULL
      ${inCategory}
      AND (${matchAll})
    ORDER BY ${order}, p."id"
    LIMIT ${opts.limit ?? 60}`;
  return rows.map((r) => r.id);
}
