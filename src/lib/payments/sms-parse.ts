// Reads an incoming-transfer SMS or app notification (InstaPay, bank, mobile
// wallet) forwarded from the platform's phone. Pure, so it is unit tested.

export interface ParsedNotice {
  incoming: boolean;
  // Candidate received amounts in piasters, best first. Balances and fees are
  // left out.
  amounts: number[];
  // Egyptian mobile numbers found in the text, as 01XXXXXXXXX.
  phones: string[];
  // Long digit/letter runs that look like a transaction reference.
  references: string[];
  // The wallet / account balance after this transfer, when the text says it.
  balance: number | null;
}

const arabicDigits = /[٠-٩۰-۹]/g;

export function normalizeDigits(text: string) {
  return text
    .replace(arabicDigits, (d) => {
      const code = d.charCodeAt(0);
      return String(code >= 0x6f0 ? code - 0x6f0 : code - 0x660);
    })
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
}

const currency = String.raw`(?:EGP|E\.?G\.?P|L\.?E\.?|جنيه(?:ا|ًا)?|جنية|ج\.?\s?م\.?|جم)`;
const number = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)`;

// Words that mean "money came in" (Arabic and English bank/wallet wording).
const incomingWords =
  /(received|receiv|credited|credit(?:ed)?\s+to|deposit|incoming|transfer(?:red)?\s+to\s+you|you\s+have\s+got|استلام|استلمت|تم\s*استقبال|استقبلت|إضافة|اضافة|أضيف|اضيف|إيداع|ايداع|وارد|واردة|تحويل\s*لك|حولك|لحسابك|إلى\s*حسابك|الي\s*حسابك|في\s*حسابك|اتحولك)/i;
// Words that mean money went out: a buyer's payment must never be confused
// with the platform paying someone.
const outgoingWords =
  /(debited|debit\s+from|withdraw|sent\s+to|you\s+sent|purchase|paid\s+to|خصم|سحب|تم\s*الدفع|دفعت|أرسلت|ارسلت|حوّلت|حولت\s*مبلغ|تم\s*تحويل\s*مبلغ.{0,40}(?:إلى|الى|ل)\s*(?:رقم|حساب)|شراء)/i;
// A number right after these is not the transferred amount.
const skipBefore =
  /(balance|bal\b|avail|available|fees?|charge|commission|رصيد|الرصيد|رسوم|مصاريف|عمولة|متاح)[^\d]{0,25}$/i;

function toPiasters(raw: string) {
  const clean = raw.replace(/,/g, "");
  const [whole, fraction = ""] = clean.split(".");
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(value) ? value : NaN;
}

export function parseNotice(raw: string): ParsedNotice {
  const text = normalizeDigits(raw).replace(/\s+/g, " ").trim();
  const amounts: number[] = [];
  const add = (value: string, index: number) => {
    if (skipBefore.test(text.slice(Math.max(0, index - 40), index))) return;
    const piasters = toPiasters(value);
    if (piasters > 0 && piasters <= 10_000_000 && !amounts.includes(piasters))
      amounts.push(piasters);
  };
  // "EGP 150.37" and "150.37 جنيه".
  for (const m of text.matchAll(new RegExp(`${currency}\\s*${number}`, "gi")))
    add(m[1], m.index ?? 0);
  for (const m of text.matchAll(new RegExp(`${number}\\s*${currency}`, "gi")))
    add(m[1], m.index ?? 0);
  // No currency word: fall back to "مبلغ 150.37" / "amount 150.37".
  if (!amounts.length)
    for (const m of text.matchAll(
      new RegExp(`(?:مبلغ|المبلغ|بمبلغ|amount|amt)\\s*:?\\s*${number}`, "gi"),
    ))
      add(m[1], m.index ?? 0);
  const phones = [
    ...new Set(
      [...text.matchAll(/(?:\+?20|0020)?(1[0125]\d{8})(?!\d)/g)].map(
        (m) => "0" + m[1],
      ),
    ),
  ];
  const references = [
    ...new Set(
      [...text.matchAll(/\b([A-Z0-9-]{6,40})\b/gi)]
        .map((m) => m[1].toUpperCase())
        .filter((r) => /\d/.test(r) && !phones.some((p) => r.endsWith(p.slice(1)))),
    ),
  ];
  const incoming = incomingWords.test(text) && !outgoingWords.test(text);
  const b = text.match(
    new RegExp(
      `(?:رصيدك(?:\\s*الحالي)?|الرصيد(?:\\s*(?:الحالي|المتاح))?|available\\s+balance|avail(?:able)?\\.?\\s*bal(?:ance)?|balance)[^\\d]{0,20}${number}`,
      "i",
    ),
  );
  const balance = b ? toPiasters(b[1]) : NaN;
  return {
    incoming,
    amounts,
    phones,
    references,
    balance: Number.isSafeInteger(balance) ? balance : null,
  };
}

// "01012345678", "+20 101 234 5678", "201012345678" → "01012345678".
// InstaPay addresses (name@instapay) are kept lower-cased.
export function normalizeAccount(value: string) {
  const text = normalizeDigits(value).trim().toLowerCase();
  if (text.includes("@")) return text.replace(/\s+/g, "");
  const digits = text.replace(/\D/g, "");
  const m = digits.match(/^(?:20|0020)?0?(1[0125]\d{8})$/);
  return m ? "0" + m[1] : digits;
}
