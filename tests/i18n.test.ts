import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { toolsFor, translate } from "../src/lib/i18n";
import { en } from "../src/i18n/en";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

test("every literal t() key in the UI has an English translation", () => {
  const missing = new Set<string>();
  for (const file of [...sources("src/app"), ...sources("src/components")]) {
    for (const m of readFileSync(file, "utf8").matchAll(/\bt\("((?:[^"\\\n]|\\.)*)"/g)) {
      const key = JSON.parse(`"${m[1]}"`) as string;
      if (/[؀-ۿ]/.test(key) && key !== "ع" && !(key in en)) missing.add(key);
    }
  }
  assert.deepEqual([...missing], []);
});

test("translations keep their placeholders", () => {
  for (const [ar, text] of Object.entries(en)) {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(vars(text), vars(ar), ar);
  }
});

test("translate falls back to Arabic and fills variables", () => {
  assert.equal(translate("en", "حفظ"), "Save");
  assert.equal(translate("ar", "حفظ"), "حفظ");
  assert.equal(translate("en", "نص مش مترجم"), "نص مش مترجم");
  assert.equal(translate("en", "بحث: {q}", { q: "canva" }), "Search: canva");
  const en2 = toolsFor("en");
  assert.equal(en2.money(123450), "EGP 1,234.5");
  assert.equal(en2.dir, "ltr");
  assert.equal(toolsFor("ar").dir, "rtl");
});

test("payout minimum defaults to EGP 1,000", async () => {
  const saved = process.env.MIN_PAYOUT_EGP;
  delete process.env.MIN_PAYOUT_EGP;
  const { MIN_PAYOUT } = await import(`../src/lib/config?min=${Date.now()}`);
  process.env.MIN_PAYOUT_EGP = saved;
  assert.equal(MIN_PAYOUT, 100_000);
});
