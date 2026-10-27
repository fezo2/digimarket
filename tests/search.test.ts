import assert from "node:assert/strict";
import test from "node:test";
import { normalizeArabic, queryGroups } from "../src/lib/search";
import { describe as metaDescription, jsonLd } from "../src/lib/seo";

test("arabic spellings fold to one form", () => {
  assert.equal(normalizeArabic("أكاونت إشتراك آمن"), "اكاونت اشتراك امن");
  assert.equal(normalizeArabic("مُدَّة سنةٌ"), "مده سنه");
  assert.equal(normalizeArabic("مصطفى ـــ شهر"), "مصطفي شهر");
  assert.equal(normalizeArabic("ChatGPT ٣ شهور!"), "chatgpt 3 شهور");
});

test("query groups expand brand names and phrases", () => {
  assert.deepEqual(queryGroups("شات جي بي تي بلس"), [
    ["شات جي بي تي", "chatgpt", "gpt"],
    ["بلس", "plus"],
  ]);
  assert.deepEqual(queryGroups("كاب كات"), [["كاب كات", "capcut"]]);
  assert.deepEqual(queryGroups("الكورسات"), [["كورسات"]]);
  assert.deepEqual(queryGroups("Canva"), [["canva"]]);
  assert.deepEqual(queryGroups("  !!  "), []);
});

test("meta descriptions are one short line", () => {
  const long = "كلمة ".repeat(80);
  const d = metaDescription(long);
  assert.ok(d.length <= 156 && d.endsWith("…"));
  assert.equal(metaDescription("سطر\n\nتاني"), "سطر تاني");
  assert.ok(!jsonLd({ x: "</script>" }).includes("</"));
});
