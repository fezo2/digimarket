# Phase 4: seller wallet, payouts, admin refunds and stuck orders

Branch: `phase-4-wallet-payouts` → PR into `main`. Start only after phase 3 is merged.

Goal: a seller sees an honest balance (held vs withdrawable) built only from the ledger, asks for a payout, and the admin pays it by hand (InstaPay / bank / wallet) and records it. The admin can also resolve paid orders that were not delivered, and refund a delivered order, with the seller's ledger corrected. Read `AGENTS.md` first; every rule there applies.

Out of scope (later phases): automatic payouts through an API, partial refunds, buyer-opened disputes, chat, reviews, Telegram notifications.

## 1. Ledger rules (read before writing any code)

The ledger is the only source of truth for money. Never store a balance column, never update or delete a `LedgerEntry`; corrections are new rows.

| Event | Type | Amount | availableAt |
|---|---|---|---|
| Delivered sale (exists since phase 3) | `SALE` | `+sellerNet` | now + hold days |
| Payout requested | `PAYOUT` | `-amount` | now |
| Payout rejected by admin | `PAYOUT` | `+amount` (reversal, same `payoutId`) | now |
| Delivered order refunded by admin | `REFUND` | `-sellerNet` of that item | the original SALE row's `availableAt` (so a refund of held money reduces held, not withdrawable) |
| Manual correction by admin | `ADJUSTMENT` | any non-zero integer | now |

- `available = sum(amount where availableAt <= now)`, `held = sum(amount where availableAt > now)`, `total = available + held`.
- `available` may become negative (refund after a payout). A seller with `available < MIN_PAYOUT` can't request a payout.
- Put the math in a pure function `computeBalance(entries, now)` in `src/lib/ledger.ts` and make `sellerBalance` use a single SQL aggregate (or this function), not two racy queries. Unit test the function.
- Any code that reads the balance to decide something (a payout request) must do it inside a transaction that first locks the seller row: `SELECT id FROM "SellerProfile" WHERE id = $1 FOR UPDATE`.

## 2. Schema changes (one migration named `wallet_payouts`)

```prisma
model SellerProfile {
  // add: the payout destination the seller saved last (shown pre-filled)
  payoutMethod      PayoutMethod?
  payoutAccount     String?   // InstaPay address / wallet number / IBAN
  payoutHolderName  String?   // must match the KYC name; the admin checks it
  payoutUpdatedAt   DateTime?
}

model Payout {
  // add:
  holderName   String
  rejectReason String?
  processedById String?   // admin user id
  @@index([status, createdAt])
  @@index([sellerId, createdAt])
}

model Order {
  // add:
  refundedAt   DateTime?
  refundNote   String?
}

model AuditLog {
  id        String   @id @default(cuid())
  actorId   String   // admin user id
  action    String   // "payout.paid", "payout.rejected", "order.refunded", "order.redelivered", "ledger.adjustment", "seller.payout_account_changed"
  targetId  String
  data      String?  // JSON, never secrets (no codes, no full account numbers)
  createdAt DateTime @default(now())
  @@index([targetId, createdAt])
}
```

`LedgerEntry` needs `@@index([sellerId, availableAt])`. Add a partial unique index in raw SQL so a seller can have at most one open payout: `CREATE UNIQUE INDEX "Payout_one_open_per_seller" ON "Payout"("sellerId") WHERE status = 'REQUESTED';`

## 3. Seller wallet: `/seller/wallet`

Add "المحفظة" to the seller nav.

1. Three cards: الرصيد المتاح للسحب، رصيد معلّق (with the date the next held amount becomes available), الإجمالي. Formatted with `formatEGP`.
2. Ledger table, newest first, 30 per page (`?page=`): date, type in Arabic (بيع / سحب / استرداد / تسوية), order number link when `orderItemId` is set, amount coloured green/red, "متاح من" date for held rows.
3. Payout destination form: method (InstaPay / تحويل بنكي / محفظة موبايل), account, holder name, **and the seller's current password**. Validate per method with zod: InstaPay = `name@instapay` or an Egyptian mobile; wallet = Egyptian mobile `01[0125]\d{8}`; bank = IBAN `EG\d{27}`. Changing the destination writes an `AuditLog` row and blocks payout requests for 24 hours after the change (show the time it unlocks). This stops a stolen session from redirecting money instantly.
4. Payout request form: amount in EGP (convert to piasters), button "اطلب سحب". Rules, all checked server-side in one transaction after locking the seller row:
   - seller KYC is `APPROVED`;
   - a saved destination exists and its 24-hour lock has passed;
   - `MIN_PAYOUT <= amount <= available`;
   - no other `REQUESTED` payout (also guaranteed by the unique index; catch the P2002 and return the Arabic message);
   - create the `Payout` (copy method, account, holder name from the profile) and the `PAYOUT -amount` ledger row in the same transaction.
5. Payout history: date, amount, method, last 4 characters of the account, status (قيد المراجعة / اتدفع / مرفوض), reference or reject reason.

## 4. Admin payouts: `/admin/payouts`

1. Tabs by status, oldest `REQUESTED` first. Each row: store name, seller type, KYC legal name, holder name (highlight in red if it differs from the KYC name), method, full account, amount, seller's current available balance.
2. "تم الدفع" form: transfer reference (required, max 100). Uses `updateMany({ where: { id, status: "REQUESTED" } })` and does nothing if count is 0, so a double click can't pay twice. Sets `processedAt`, `processedById`, `reference`. No ledger row (the money left at request time).
3. "رفض" form: reason (required). Same status guard; in the same transaction create the `PAYOUT +amount` reversal row with the same `payoutId`.
4. Every action writes an `AuditLog` row. Only `requireAdmin()` can reach the page and actions.

## 5. Admin order resolution: `/admin/orders`

Extend the phase 3 page.

1. Filter "محتاج مراجعة": `status = PAID` and an item with `deliveredAt = null`. Show why when known (amount mismatch, coupon exhausted, out of stock, missing delivery data); store the reason on the order when `markOrderPaid` takes that branch (add `reviewReason String?` to `Order` in the same migration) instead of only logging it.
2. Action "إعادة التسليم": refactor the delivery part of `markOrderPaid` into `deliverPaidOrder(tx, orderId)` and reuse it. It locks the order, re-checks the amount paid (store `paidAmount Int?` on `Order` when the payment is recorded), stock and coupon, and on success marks delivered, writes the SALE row exactly once (guard: no existing SALE row for that `orderItemId`). On failure it returns the Arabic reason and changes nothing.
3. Action "تم رد الفلوس للمشتري" (refund recorded): for a paid order the admin already refunded outside the platform (Paymob dashboard or transfer). Required note. In one transaction with the order locked and a status guard `status = PAID`:
   - set `status = REFUNDED`, `refundedAt`, `refundNote`;
   - release any `RESERVED` stock for the order;
   - if a SALE row exists for the item, add `REFUND -sellerNet` with `availableAt` = that SALE row's `availableAt`;
   - sold codes stay `SOLD` (the buyer has seen them); do not decrement `usedCount` of the coupon; decrement `Product.soldCount` by the item quantity only if it was delivered;
   - write an `AuditLog` row.
4. The buyer's order page shows "اتردّت الفلوس" for `REFUNDED` and no longer shows the delivered content.

## 6. Admin manual adjustment

On the admin seller page (or `/admin/sellers/[id]/ledger`): form with amount in EGP (may be negative), required note, current password of the admin. Creates an `ADJUSTMENT` row available now and an `AuditLog` row. Show that seller's balance and last 50 ledger rows.

## 7. Security checklist

- Every server action: zod input, `requireSeller()` / `requireAdmin()`, ownership check (`sellerId` of the session, never from the form).
- Amounts are integers in piasters on the server; parse EGP input with a strict regex (`^\d{1,7}(\.\d{1,2})?$`), never `parseFloat` maths.
- No balance check outside a transaction that holds the seller lock.
- Full payout account numbers are shown only to the owning seller (their own form) and admins; history and audit data keep only the last 4 characters.
- Status changes always use a `where: { status: <expected> }` guard and treat count 0 as "already handled".
- Never delete or update existing `LedgerEntry` rows.

## 8. Tests

Unit (`npm test`):
- `computeBalance`: held vs available split, negative available, refund of a held sale lowers held only.
- Payout destination validation for the three methods (valid and invalid cases).
- EGP string to piasters parser (`"100" → 10000`, `"99.5" → 9950`, rejects `"1e3"`, `"-5"`, `"10.123"`).

Integration (`npm run test:integration`, PostgreSQL):
- Payout over the available balance is rejected; below `MIN_PAYOUT` rejected; destination changed less than 24 hours ago rejected.
- Two concurrent payout requests for the same seller: exactly one succeeds and exactly one PAYOUT ledger row exists.
- Rejecting a payout restores the available balance; marking paid twice changes nothing the second time.
- Refunding a delivered order whose earnings are still held: held goes down, available unchanged; refunding after the hold ended and after a payout makes available negative and blocks the next payout.
- Refunding a paid-but-undelivered order releases its reserved stock and creates no ledger row.
- Re-delivery succeeds after the admin adds stock to an out-of-stock paid order, and creates the SALE row exactly once even when called twice in parallel.

## Acceptance checklist (put results in the PR body)

- [ ] Seller with a delivered sale sees it as held, and as available after the hold days (simulate by editing `availableAt` in the test DB only).
- [ ] Seller saves a destination with the password, waits out the lock (shorten it with an env var in tests only, default 24h), requests 100 EGP, and the available balance drops at once.
- [ ] Admin marks it paid with a reference; seller sees "اتدفع" and the reference.
- [ ] Admin rejects another request with a reason; the balance comes back.
- [ ] Admin refunds a delivered order; the ledger shows the REFUND row and the buyer page shows "اتردّت الفلوس".
- [ ] Admin re-delivers a paid order that was out of stock after adding codes.
- [ ] `npm test`, `npm run test:integration`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass.
