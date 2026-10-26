import assert from "node:assert/strict";
import test from "node:test";
import { maskContact, canReview, canEditReview } from "../src/lib/community-rules";
for (const phone of ["01012345678", "011 1234 5678", "012-1234-5678", "+201512345678", "+20 10 1234 5678", "+20-010-1234-5678"]) {
  test(`contact masker removes phone ${phone}`, () => { assert.deepEqual(maskContact(`اتصل ${phone} دلوقتي`), { body: "اتصل [محذوف] دلوقتي", flagged: true }); });
}
for (const link of ["https://wa.me/201012345678", "wa.me/201012345678", "https://t.me/seller", "https://telegram.me/seller", "https://api.whatsapp.com/send?phone=123"]) {
  test(`contact masker removes ${link}`, () => { assert.equal(maskContact(link).body, "[محذوف]"); assert.equal(maskContact(link).flagged, true); });
}
test("masker preserves emails, prices, order numbers and ordinary text", () => {
  for (const text of ["user@example.com", "01012345678@example.com", "user@telegram.org", "طلب 123456 والسعر 200.50 جنيه", "الكود ABC-123-456"]) assert.deepEqual(maskContact(text), { body: text, flagged: false });
});
test("review requires PAID delivery and expires at 30 days", () => {
  const delivered = new Date("2026-10-01T00:00:00Z");
  assert.equal(canReview("PAID", delivered, delivered), true);
  assert.equal(canReview("PAID", delivered, new Date(delivered.getTime()+30*86400000)), true);
  assert.equal(canReview("PAID", delivered, new Date(delivered.getTime()+30*86400000+1)), false);
  assert.equal(canReview("PAID", null), false);
  for (const status of ["REFUNDED", "CANCELLED", "PENDING_PAYMENT"]) assert.equal(canReview(status, delivered, delivered), false);
});
test("review edit is allowed once within seven days", () => {
  const created = new Date("2026-10-01T00:00:00Z");
  assert.equal(canEditReview(created, false, new Date(created.getTime()+7*86400000)), true);
  assert.equal(canEditReview(created, false, new Date(created.getTime()+7*86400000+1)), false);
  assert.equal(canEditReview(created, true, created), false);
});
