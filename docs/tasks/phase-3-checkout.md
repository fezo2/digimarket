# Phase 3: checkout, payment, instant delivery, seller earnings

Branch: `phase-3-checkout` → PR into `main`. Start only after phase 2 is merged.

Goal: a logged-in buyer buys one product (with options and quantity), pays through a payment provider, and instantly sees the code / file / text / link. The platform takes the category commission and the seller's net goes into the ledger as held earnings. Read `AGENTS.md` first; every rule there applies.

Out of scope (later phases): cart with several products, chat, reviews, disputes, refunds, payouts, Telegram notifications.

## 1. Schema changes (one migration named `checkout`)

```prisma
enum StockStatus {
  AVAILABLE
  RESERVED // held for an unpaid order until it expires
  SOLD
}

model Order {
  // add:
  expiresAt DateTime // unpaid orders hold stock until this time
  @@index([status, expiresAt])
  @@index([buyerId, createdAt])
}

model OrderItem {
  // add (snapshot at purchase time, so later product edits don't change what the buyer got):
  deliveryType    DeliveryType
  deliveryContent String?
  instructions    String?
  @@index([sellerId])
}
```

No other schema changes.

## 2. Pricing: `src/lib/pricing.ts` (pure functions, no DB)

```ts
quote(input: {
  basePrice: number;                       // piasters
  optionDeltas: number[];                  // piasters, from the chosen select values
  quantity: number;
  quantityDiscounts: { minQty: number; percentOff: number }[];
  coupon?: { percentOff: number | null; amountOff: number | null; minTotal: number } | null;
  commissionBps: number;
}): { unitPrice; subtotal; quantityDiscount; couponDiscount; total; commission; sellerNet }
```

Rules, in this order:
1. `unitPrice = basePrice + sum(optionDeltas)`; throw if `unitPrice < 100`.
2. `subtotal = unitPrice * quantity`.
3. Quantity discount: the highest `percentOff` whose `minQty <= quantity`; `quantityDiscount = round(subtotal * percentOff / 100)`.
4. Coupon applies to `subtotal - quantityDiscount`, only if that is `>= minTotal`. Percent: `round(x * percentOff / 100)`; amount: `min(amountOff, x)`. Total can never go below 100 piasters.
5. `commission = commissionFor(total, commissionBps)` (from `src/lib/money.ts`), `sellerNet = total - commission`.

All rounding with `Math.round`. Add unit tests for this file with `node:test` + `tsx` (`npm run test` script): no discount, quantity tier picked correctly, percent coupon, amount coupon bigger than total, coupon below `minTotal`, negative option delta, commission on the discounted total.

## 3. Payment providers: `src/lib/payments/`

```ts
interface PaymentProvider {
  name: "test" | "paymob";
  // returns the URL to send the buyer to
  createPayment(order: { id: string; number: number; total: number; buyer: { name: string; email: string; phone?: string | null } }): Promise<string>;
}
```

`getPaymentProvider()` picks by env `PAYMENT_PROVIDER` (`test` default in development; throw at startup in production if it is `test`).

**Test provider**: returns `/pay/test/<orderId>`. That page (only reachable when the provider is `test`) shows the order total with two buttons "دفع ناجح" and "دفع فاشل". Success calls `markOrderPaid(orderId, { provider: "test", reference: "test-<timestamp>", amount: order.total })`; failure goes back to the checkout page with an error.

**Paymob** (Intention API + Unified Checkout), env: `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_INTEGRATION_IDS` (comma separated, card + wallet), `APP_URL`.
- `createPayment`: `POST https://accept.paymob.com/v1/intention/` with header `Authorization: Token <secret>` and body `{ amount: total, currency: "EGP", payment_methods: [integration ids as numbers], items: [{ name, amount: total, quantity: 1 }], billing_data: { first_name, last_name, email, phone_number }, special_reference: order.id, notification_url: APP_URL + "/api/payments/paymob/webhook", redirection_url: APP_URL + "/api/payments/paymob/return" }`. Missing billing fields must be `"NA"`. Return `https://accept.paymob.com/unifiedcheckout/?publicKey=<public>&clientSecret=<client_secret>`.
- Webhook `POST /api/payments/paymob/webhook`: read `hmac` from the query string. Build the HMAC string by concatenating these fields of `obj` in this exact order: `amount_cents, created_at, currency, error_occured, has_parent_transaction, id, integration_id, is_3d_secure, is_auth, is_capture, is_refunded, is_standalone_payment, is_voided, order.id, owner, pending, source_data.pan, source_data.sub_type, source_data.type, success`. Compute HMAC-SHA512 hex with `PAYMOB_HMAC_SECRET` and compare with `crypto.timingSafeEqual`. Reject (401) on mismatch. If `success === true && pending === false`, find our order by `obj.order.merchant_order_id` (the `special_reference`) and call `markOrderPaid(..., { provider: "paymob", reference: String(obj.id), amount: obj.amount_cents })`. Always return 200 after a valid HMAC so Paymob stops retrying.
- Return `GET /api/payments/paymob/return`: never trust its query for payment status. Only redirect to `/account/orders/<id>`; that page shows "بنأكد الدفع…" while the order is still `PENDING_PAYMENT` and refreshes every 3 seconds for up to 1 minute.
- Unit test the HMAC function with a fixed sample object and a known secret.

## 4. Order service: `src/lib/orders.ts`

All money and stock changes live here, each in one `db.$transaction`.

`createOrder({ buyerId, productId, quantity, selections, textInputs })`:
- Load product with options; it must be `ACTIVE`, `salesEnabled`, and the seller `kycStatus === "APPROVED"`. A seller cannot buy their own product.
- Validate `quantity` within `minQty..maxQty`, every required option answered, each select value belongs to that option (never trust prices from the client; read deltas from the DB).
- Call `releaseExpiredOrders()` first.
- `UNIQUE_CODES`: reserve stock with a single SQL statement so two buyers can't grab the same code, e.g. `UPDATE "StockItem" SET status='RESERVED', "orderItemId"=$1 WHERE id IN (SELECT id FROM "StockItem" WHERE "productId"=$2 AND status='AVAILABLE' ORDER BY "createdAt" LIMIT $3 FOR UPDATE SKIP LOCKED)`. If fewer than `quantity` rows were updated, throw "الكمية المتاحة مش كفاية".
- Create the order with `expiresAt = now + 30 minutes`, one order item with the quote's numbers, `commissionBps` copied from the category, `optionsJson` (labels and text inputs the buyer chose), and the delivery snapshot.

`applyCoupon(orderId, buyerId, code)`: only on `PENDING_PAYMENT` orders of that buyer. Coupon must be active, not expired, under `usageLimit`, and either global (`sellerId = null`) or the item's seller. Recompute the item and order numbers with `quote`. Allow removing the coupon.

`markOrderPaid(orderId, { provider, reference, amount })` must be idempotent (Paymob retries webhooks):
- `updateMany({ where: { id, status: "PENDING_PAYMENT" }, data: { status: "PAID", paidAt, paymentProvider, paymentRef } })`; if count is 0, return without doing anything.
- If `amount !== order.total`, do not deliver; log it and leave the order for admin review (set status back is not needed, just don't deliver; write a clear `console.error`).
- Stock: move this item's `RESERVED` rows to `SOLD` with `soldAt`. If the order had already expired and its codes were released, try to take `AVAILABLE` ones the same way as in `createOrder`. If there are still not enough, leave `deliveredAt` null and log; the admin will refund (phase 5).
- Set `deliveredAt`, increment `product.soldCount` by quantity, increment `coupon.usedCount`.
- Create a `LedgerEntry` `{ type: "SALE", amount: sellerNet, availableAt: now + SELLER_TIERS[seller.type].holdDays days, orderItemId, note: "طلب #<number>" }`.

`releaseExpiredOrders()`: orders `PENDING_PAYMENT` with `expiresAt < now` become `CANCELLED`, and their `RESERVED` stock goes back to `AVAILABLE` with `orderItemId = null`.

## 5. Pages

- Product page: replace the disabled button with a client `BuyBox` (option selects, text inputs, quantity, live price using `quote` without coupon, and the matching quantity discount line). Submitting calls a server action that requires login (redirect to `/login?next=/products/<slug>`), calls `createOrder`, and redirects to `/checkout/<orderId>`. Out of stock shows "نفذت الكمية" disabled. If phase 2 already added a price component, extend it instead of adding a second one.
- `/checkout/[id]` (buyer only, `PENDING_PAYMENT` only): item, chosen options, quantity, price breakdown (subtotal, quantity discount, coupon, total), coupon form, a countdown to `expiresAt`, and "ادفع دلوقتي" which calls the provider and redirects. Expired → message and a link back to the product.
- `/account/orders/[id]` (buyer only): status; when paid and delivered, show each code in a box with a copy button, or the text / link / file download, plus the instructions. Files download through a route that checks the buyer owns a paid item for that product (`/api/orders/[itemId]/file`).
- `/account`: list orders with status and link to each.
- `/seller/sales`: the seller's paid order items (date, order number, product, quantity, total, commission, net) and a ledger table (date, type, amount, available date) with the held / withdrawable totals at the top. Link it from the seller dashboard and the seller nav. Never show codes or buyer emails here.
- `/admin/orders`: latest 100 orders with status, buyer, total, provider, reference; highlight paid orders whose item has `deliveredAt = null`.

## 6. Security checklist

- Every page and route checks ownership: buyer for checkout and order pages, seller for sales, admin for admin.
- Codes and delivery content only render on `/account/orders/[id]` for the buyer of a paid, delivered item.
- Prices, discounts, commission and stock are always computed on the server.
- The webhook is the only thing that marks Paymob orders paid.

## Acceptance checklist (put results in the PR body)

- [ ] `npm run test` passes (pricing + HMAC).
- [ ] Buy a `UNIQUE_CODES` product, qty 2, with an option that adds to the price and a quantity discount: checkout total matches the hand calculation; after test payment the buyer sees 2 different codes; stock shows 2 SOLD.
- [ ] Two browsers start checkout for the last code at the same time: only one gets it, the other sees "الكمية المتاحة مش كفاية".
- [ ] Let an order expire (temporarily set 1 minute): it becomes CANCELLED and its code is AVAILABLE again.
- [ ] Calling `markOrderPaid` twice creates one ledger entry, not two.
- [ ] Seller sales page shows commission at the category rate and the entry as held until `holdDays` later; company seller holds 3 days, individual 7.
- [ ] Another buyer opening `/account/orders/<id>` or the file route of someone else's order gets 404.
- [ ] A coupon for seller A does not apply to seller B's product; an expired coupon is rejected.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` pass.
