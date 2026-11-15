import assert from "node:assert/strict";
import test from "node:test";
import { absoluteUrl, englishPath, localized } from "../src/lib/seo";

test("englishPath adds lang=en to plain and query URLs", () => {
  assert.equal(englishPath("/"), "/?lang=en");
  assert.equal(englishPath("/categories/ai?page=2"), "/categories/ai?page=2&lang=en");
});

test("localized gives each language its own canonical and hreflang pair", () => {
  assert.deepEqual(localized("/products/x", "ar"), {
    canonical: "/products/x",
    languages: { "ar-EG": "/products/x", en: "/products/x?lang=en", "x-default": "/products/x" },
  });
  assert.equal(localized("/products/x", "en").canonical, "/products/x?lang=en");
});

test("absoluteUrl keeps full URLs and prefixes paths", () => {
  assert.equal(absoluteUrl("https://cdn.example/a.png"), "https://cdn.example/a.png");
  assert.match(absoluteUrl("/img/s/a.png"), /^https?:\/\/[^/]+\/img\/s\/a\.png$/);
});
