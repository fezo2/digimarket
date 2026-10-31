import test from "node:test";
import assert from "node:assert/strict";
import { guessCategorySlug, supplierPrice } from "../src/lib/supplier-pricing";

const at = (costMills: number) =>
  supplierPrice({ costMills, usdRate: 5500, multiplierBps: 25000 });

test("price is cost × dollar rate × multiplier, rounded up to a pound", () => {
  assert.equal(at(1000), 13800); // $1 × 55 × 2.5 = 137.5 → 138
  assert.equal(at(7800), 107300); // $7.80 → 1072.5 → 1073
  assert.equal(at(190), 2700); // $0.19 → 26.125 → 27
  assert.equal(at(20), 300); // $0.02 → 2.75 → 3
});
test("never below one pound", () => {
  assert.equal(at(1), 100);
});
test("guesses the store category from the supplier name", () => {
  assert.equal(guessCategorySlug("ChatGPT Plus 1 Month FW"), "chatgpt");
  assert.equal(guessCategorySlug("Nord VPN 3 months Account"), "nordvpn");
  assert.equal(guessCategorySlug("Avira VPN 1 Month"), "vpn");
  assert.equal(guessCategorySlug("Youtube Premium Account 1M"), "youtube-premium");
  assert.equal(guessCategorySlug("FreeFire 25 Diamonds"), "free-fire-diamonds");
  assert.equal(guessCategorySlug("Microsoft Office 365 Plus 1 year"), "microsoft-office");
  assert.equal(guessCategorySlug("Something else"), "productivity");
});
