import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAccount, parseNotice } from "../src/lib/payments/sms-parse";

async function pick() {
  const mod = await import("../src/lib/auto-payments-pick");
  return mod.pickOrder;
}

test("Vodafone Cash style Arabic SMS: amount, sender, not the balance", () => {
  const n = parseNotice(
    "تم استلام مبلغ 150.37 جنيه من رقم 01012345678 المسجل باسم احمد. رصيدك الحالي 1,250.37 جنيه. رقم العملية 004512367891",
  );
  assert.equal(n.incoming, true);
  assert.deepEqual(n.amounts, [15037]);
  assert.deepEqual(n.phones, ["01012345678"]);
  assert.ok(n.references.includes("004512367891"));
  assert.equal(n.balance, 125037);
});

test("real Vodafone Cash receipt wording", () => {
  const n = parseNotice(
    "تم استلام مبلغ 5.00 جنيه من 01129791666؛\nالمسجل بإسم KAREM EMAD على رقم محفظتك 01011964843 بتاريخ 31-10-26 19:39.\nرصيدك الحالي: 178.51 جنيه\nرقم العملية: 025291598184",
  );
  assert.equal(n.incoming, true);
  assert.deepEqual(n.amounts, [500]);
  assert.equal(n.balance, 17851);
  assert.ok(n.phones.includes("01129791666"));
  // Vodafone's "confirm a payment" prompts are not incoming money.
  assert.equal(
    parseNotice("لتأكيد دفع مبلغ 10.0 جنيه ج ل Twist من محفظة فودافون كاش؛ اطلب #9*55*").incoming,
    false,
  );
});

test("English bank InstaPay SMS", () => {
  const n = parseNotice(
    "Your account **4521 was credited with EGP 1,200.05 via InstaPay from MOHAMED A on 31/10. Available balance EGP 9,000.00",
  );
  assert.equal(n.incoming, true);
  assert.deepEqual(n.amounts, [120005]);
});

test("Arabic-Indic digits", () => {
  const n = parseNotice("استلمت ١٥٠٫٣٧ جنيه من ٠١١٢٣٤٥٦٧٨٩");
  assert.deepEqual(n.amounts, [15037]);
  assert.deepEqual(n.phones, ["01123456789"]);
});

test("outgoing transfers are never incoming", () => {
  for (const text of [
    "تم تحويل مبلغ 150 جنيه إلى رقم 01012345678",
    "Your account was debited with EGP 150.00",
    "تم خصم 150 جنيه من حسابك",
  ])
    assert.equal(parseNotice(text).incoming, false, text);
});

test("account normalisation", () => {
  assert.equal(normalizeAccount("+20 101 234 5678"), "01012345678");
  assert.equal(normalizeAccount("201012345678"), "01012345678");
  assert.equal(normalizeAccount("Ahmed.Ali@InstaPay"), "ahmed.ali@instapay");
});

test("matching: phone + amount, unique amount, ambiguity", async () => {
  const pickOrder = await pick();
  const base = { manualPayment: null };
  const a = { ...base, id: "a", number: 1, total: 15000, payAmount: 15037, payFrom: "01012345678" };
  const b = { ...base, id: "b", number: 2, total: 15000, payAmount: 15012, payFrom: "01198765432" };
  // Exact unique amount picks one order even without a phone.
  assert.equal(pickOrder(parseNotice("استلمت 150.37 جنيه"), [a, b]).order?.id, "a");
  // Rounded amount from the declared number.
  assert.equal(
    pickOrder(parseNotice("تم استلام مبلغ 150 جنيه من رقم 01198765432"), [a, b]).order?.id,
    "b",
  );
  // Rounded amount, unknown number: two orders fit, nobody is confirmed.
  assert.equal(pickOrder(parseNotice("تم استلام مبلغ 150 جنيه من رقم 01555555555"), [a, b]).order, undefined);
  // Less than the total never confirms.
  assert.equal(pickOrder(parseNotice("تم استلام مبلغ 100 جنيه من رقم 01012345678"), [a, b]).order, undefined);
});
