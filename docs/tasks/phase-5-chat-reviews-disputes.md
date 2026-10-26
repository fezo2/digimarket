# Phase 5: order chat, reviews, disputes

Branch: `phase-5-chat-reviews-disputes` → PR into `main`. Start only after phase 4 is merged.

Goal: after buying, the buyer and the seller talk in a chat attached to the order; the buyer rates the purchase (positive / negative, like Digiseller) and the seller can reply; if the product doesn't work, the buyer opens a complaint (dispute), the seller's earnings for that item are frozen, and the admin decides refund or no refund. Read `AGENTS.md` first; every rule there applies. Reuse phase 4 code (`refundOrder`, `lockOrder`, `lockSeller`, `AuditLog`, `sellerBalance`) instead of writing new money logic.

Out of scope (later phases): pre-sale questions on a product page, real-time sockets, Telegram / email notifications, partial refunds.

## 1. Schema changes (one migration named `chat_reviews_disputes`)

```prisma
model Message {
  // existing: id, orderId, senderId, body, createdAt
  attachmentKey String?   // private storage key of one image, never a public URL
  flagged       Boolean   @default(false) // contact info was masked, admin should look
  @@index([orderId, createdAt]) // keep
}

model OrderRead {           // unread counters, one row per participant per order
  orderId    String
  userId     String
  lastReadAt DateTime
  @@id([orderId, userId])
}

model Review {
  // existing fields stay; add:
  updatedAt     DateTime?
  editedOnce    Boolean   @default(false)
  sellerReplyAt DateTime?
  hiddenAt      DateTime? // admin hid it (abuse); hidden reviews don't count
  hiddenReason  String?
  @@index([productId, createdAt])
  @@index([sellerId, createdAt])
}

model Product       { positiveReviews Int @default(0)  negativeReviews Int @default(0) }
model SellerProfile { positiveReviews Int @default(0)  negativeReviews Int @default(0) }

enum DisputeStatus {
  OPEN
  RESOLVED_REFUND      // admin refunded
  RESOLVED_NO_REFUND   // admin decided no refund
  CLOSED_BY_BUYER      // buyer says the seller fixed it
}

model Dispute {
  // existing fields stay; add:
  resolvedById String?
  @@index([status, createdAt])
  @@index([orderItemId])
}
```

Add a partial unique index in raw SQL: one open dispute per item: `CREATE UNIQUE INDEX "Dispute_one_open_per_item" ON "Dispute"("orderItemId") WHERE status = 'OPEN';`

Review counters on `Product` / `SellerProfile` are display caches, not money. Update them in the same transaction as every create, edit (positive ↔ negative), hide and unhide. Backfill them in the migration from existing non-hidden reviews.

## 2. Order chat

Page: the chat sits at the bottom of `/account/orders/[id]` for the buyer and on a new `/seller/sales/[orderId]` page for the seller. Admins read and write from `/admin/orders/[id]`.

Rules (put them in `src/lib/chat.ts`, server-only):
1. Participants: the order's buyer, the seller of the order's item, and any admin. Everyone else gets 404. Check this on every read, every send and every attachment download.
2. Chat opens only when the order is `PAID` or `REFUNDED`. Not for `PENDING_PAYMENT` / `CANCELLED`.
3. Sending stops 30 days after `paidAt` unless a dispute on the order is `OPEN` (then it stays open until the dispute is resolved). Reading always works.
4. Body: trimmed, 1–2000 characters, stored as plain text and rendered as text (`whitespace-pre-wrap`, never HTML, links not clickable).
5. Off-platform protection: before saving a message from the buyer or the seller, mask Egyptian phone numbers (`01[0125]\d{8}`, also with spaces / dashes / `+20`), and `wa.me`, `whatsapp`, `t.me`, `telegram` links as `[محذوف]`, set `flagged = true`, and show the sender a note "مش مسموح بمشاركة وسائل تواصل خارج الموقع". Do not mask emails (sellers send account logins). Admin messages are never masked. Unit test the masker.
6. One optional image per message (jpg / png / webp, max 5 MB) through `savePrivateFile("chat/<orderId>", file)`. Download route `/api/orders/[orderId]/messages/[messageId]/attachment` with the participant check, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`.
7. Rate limit: max 20 messages per user per order per 10 minutes, counted from the `Message` table inside the send transaction (no in-memory limiter).
8. Unread: `OrderRead` upsert when a participant opens the chat. Show an unread badge on "طلباتي" for buyers, on "المبيعات" for sellers, and on admin orders for orders with an open dispute.
9. Refresh: a small client component calls `router.refresh()` every 10 seconds while the tab is visible (`document.visibilityState`), and stops after 30 minutes idle.
10. Each message shows the sender role (المشتري / التاجر / الإدارة), never the other side's email or phone.

## 3. Reviews

1. Who and when: only the buyer of a `PAID` order item with `deliveredAt` set, within 30 days of `deliveredAt`, one review per order item (`orderItemId @unique` already exists). Not allowed on `REFUNDED` orders; if an order is refunded later, hide its review automatically with reason "الطلب اترد" (inside `refundOrder`'s transaction, adjusting the counters).
2. Form on the buyer's order page: 👍 / 👎 and an optional comment (max 1000). The buyer can edit once within 7 days of creating it (`editedOnce`).
3. Seller reply: once, max 1000 characters, from `/seller/sales/[orderId]` and from a new `/seller/reviews` list (filter positive / negative / without reply).
4. Display: product page shows "X% تقييمات إيجابية (N)" from the cached counters, then the latest 10 non-hidden reviews with buyer first name only, date, comment and seller reply, and a "عرض الكل" page with pagination (20 per page). Store page uses the store counters. Product cards in listings show the positive % when N ≥ 1.
5. Admin: `/admin/reviews` list with hide / unhide (reason required), audit logged.
6. Comments and replies are rendered as text. Strip nothing else; React escaping is enough.

## 4. Disputes (الشكاوى)

1. Who and when: the buyer of a `PAID` and delivered item, within 7 days of `deliveredAt`. One `OPEN` dispute per item (partial unique index; catch P2002 and return an Arabic message). Reason required (20–2000 chars) plus an optional image (same rules as chat).
2. Opening a dispute posts an automatic system line in the order chat and keeps the chat open (see 2.3).
3. Freezing money: while a dispute is `OPEN`, the seller's withdrawable balance used by `requestPayout` must exclude that item's `sellerNet` if its SALE row is already available. Implement `frozenAmount(sellerId, tx)` = sum of `sellerNet` of items with an `OPEN` dispute whose SALE `availableAt <= now` and that have no REFUND row yet. In `requestPayout` (under the seller lock) check `amount <= available - frozen`. Show "مبلغ مجمّد بسبب شكوى" on the wallet page. Held money needs nothing extra: it can't be withdrawn anyway.
4. Seller side: `/seller/disputes` list and a banner on the sale page. The seller answers in the chat (e.g. sends a replacement code). There is no seller button that changes money.
5. Buyer side: on the order page "المشكلة اتحلت" button closes it as `CLOSED_BY_BUYER` (status guard `status = OPEN`).
6. Admin side: `/admin/disputes` (open first, oldest first) showing the reason, image, chat, order, delivered content (codes visible to the admin only here) and the seller's balance. Two actions, each with a required note, status guarded, in one transaction with `AuditLog`:
   - "رد الفلوس للمشتري": reuse `refundOrder` (it already writes the REFUND ledger row and marks the order `REFUNDED`), then set the dispute `RESOLVED_REFUND`. The admin must already have refunded the buyer outside the platform; say so on the button's confirm text.
   - "رفض الشكوى": set `RESOLVED_NO_REFUND`. The money unfreezes automatically because `frozenAmount` only counts `OPEN` disputes.
   - Both post a system line in the chat with the decision and note.
7. A buyer with 3 or more `RESOLVED_NO_REFUND` disputes in the last 90 days can't open new ones; show "تواصل مع الدعم". Sellers with many `RESOLVED_REFUND` disputes are listed with a count on `/admin/sellers` (no automatic action yet).

## 5. Security checklist

- Every server action and route: zod input, `requireUser()` / `requireSeller()` / `requireAdmin()`, participant or ownership check from the session, never from the form.
- No new money logic: refunds go through `refundOrder`; the payout check gets `frozenAmount` inside the existing seller-locked transaction.
- Status changes always use `where: { status: <expected> }` and treat count 0 as already handled.
- Codes / delivered content appear only on the buyer's paid order page (existing) and the admin dispute page; never in chat system lines, audit data or logs.
- Attachments are private keys; never expose the storage path or serve them without the participant check.
- All user text (messages, reviews, replies, dispute reasons) is rendered as text.

## 6. Tests

Unit (`npm test`):
- Contact masker: phones in several formats, `+20`, wa.me / t.me links masked; emails and normal numbers (order numbers, prices) not masked.
- Review window and edit-once rules as pure functions.

Integration (`npm run test:integration`, PostgreSQL):
- A non-participant can't read or send in an order chat; a participant can; sending is refused after 30 days without a dispute and allowed with an open one.
- The 21st message in 10 minutes is refused.
- Review only after delivery, only once, edit only once; counters stay correct across create, edit 👍→👎, hide, unhide and a later refund.
- Two parallel disputes on the same item: exactly one is created.
- With an open dispute on an available sale, a payout for the full available balance is refused and one for `available - frozen` succeeds; after "رفض الشكوى" the full amount can be requested.
- "رد الفلوس" through the dispute marks the order `REFUNDED`, writes exactly one REFUND row, resolves the dispute and hides the review.
- Buyer with 3 rejected disputes in 90 days can't open a fourth.

## Acceptance checklist (put results in the PR body)

- [ ] Buyer and seller exchange messages and an image on a paid order; a third account gets 404.
- [ ] A phone number in a message is masked and the admin sees it flagged.
- [ ] Buyer leaves 👍, edits it to 👎 once; product and store percentages update; seller replies.
- [ ] Buyer opens a complaint; seller wallet shows the frozen amount; admin rejects it and the amount unfreezes.
- [ ] Another complaint is resolved with a refund; the ledger shows the REFUND row and the order shows "اتردّت الفلوس".
- [ ] `npm test`, `npm run test:integration`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass.
