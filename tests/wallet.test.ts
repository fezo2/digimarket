import assert from "node:assert/strict";
import test from "node:test";
import { computeBalance } from "../src/lib/ledger";
import { parseEGP } from "../src/lib/money";
import {
  destinationSchema,
  adjustmentSchema,
  payoutUnlockAt,
} from "../src/lib/wallet-validation";
const now = new Date("2026-10-26T12:00:00Z");
const future = new Date(now.getTime() + 1000);
test("balance splits available and held, including the exact availability boundary", () => {
  assert.deepEqual(
    computeBalance(
      [
        { amount: 100, availableAt: now },
        { amount: 200, availableAt: future },
      ],
      now,
    ),
    { available: 100, held: 200, total: 300 },
  );
  assert.deepEqual(computeBalance([], now), {
    available: 0,
    held: 0,
    total: 0,
  });
});
test("available can be negative after a refund following a payout", () => {
  assert.deepEqual(
    computeBalance(
      [
        { amount: 100, availableAt: now },
        { amount: -100, availableAt: now },
        { amount: -100, availableAt: now },
        { amount: 50, availableAt: future },
      ],
      now,
    ),
    { available: -100, held: 50, total: -50 },
  );
});
test("refunding held earnings reduces held only", () => {
  assert.deepEqual(
    computeBalance(
      [
        { amount: 100, availableAt: now },
        { amount: 200, availableAt: future },
        { amount: -200, availableAt: future },
      ],
      now,
    ),
    { available: 100, held: 0, total: 100 },
  );
});
for (const [method, valid, invalid] of [
  [
    "INSTAPAY",
    ["name@instapay", "name.one_2@instapay", "01012345678"],
    ["name@example.com", "@instapay", "name @instapay", "01312345678"],
  ],
  [
    "MOBILE_WALLET",
    ["01012345678", "01112345678", "01212345678", "01512345678"],
    ["01312345678", "+201012345678", "0101234567", "010123456789"],
  ],
  [
    "BANK_TRANSFER",
    ["EG" + "1".repeat(27)],
    [
      "EG" + "1".repeat(26),
      "EG" + "1".repeat(28),
      "GB" + "1".repeat(27),
      "EG" + "a".repeat(27),
    ],
  ],
] as const) {
  test(`${method} destination accepts valid accounts and rejects invalid ones`, () => {
    for (const account of valid)
      assert.equal(
        destinationSchema.safeParse({
          method,
          account,
          holderName: "Seller Name",
        }).success,
        true,
        account,
      );
    for (const account of invalid)
      assert.equal(
        destinationSchema.safeParse({
          method,
          account,
          holderName: "Seller Name",
        }).success,
        false,
        account,
      );
  });
}
test("EGP parser uses strict decimals and integer piasters", () => {
  assert.equal(parseEGP("100"), 10000);
  assert.equal(parseEGP("99.5"), 9950);
  assert.equal(parseEGP("0.01"), 1);
  for (const bad of [
    "1e3",
    "-5",
    "10.123",
    "",
    " 100",
    "100 ",
    "+100",
    "1,000",
    "10000000",
    "NaN",
    "Infinity",
  ])
    assert.throws(() => parseEGP(bad), bad);
  assert.equal(adjustmentSchema.parse("-99.5"), -9950);
  assert.equal(adjustmentSchema.safeParse("0").success, false);
});
test("payout lock defaults to 24 hours and test override cannot shorten production", () => {
  const env = process.env as Record<string, string | undefined>;
  const before = { mode: env.NODE_ENV, duration: env.TEST_PAYOUT_LOCK_MS };
  try {
    env.TEST_PAYOUT_LOCK_MS = "0";
    for (const mode of ["production", "development"]) {
      env.NODE_ENV = mode;
      assert.equal(payoutUnlockAt(now).getTime() - now.getTime(), 86400000);
    }
    env.NODE_ENV = "test";
    assert.equal(payoutUnlockAt(now).getTime(), now.getTime());
  } finally {
    if (before.mode === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = before.mode;
    if (before.duration === undefined) delete env.TEST_PAYOUT_LOCK_MS;
    else env.TEST_PAYOUT_LOCK_MS = before.duration;
  }
});
