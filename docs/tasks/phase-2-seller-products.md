# Phase 2: seller product management

Branch: `phase-2-seller-products` → PR into `main`.

Goal: an approved seller can create, edit, and manage their own products, upload stock codes, and an admin can review products before they go live. Buyers still cannot pay (that is phase 3).

The data model already exists in `prisma/schema.prisma` (`Product`, `ProductOption`, `ProductOptionValue`, `QuantityDiscount`, `StockItem`). Avoid schema changes unless something is truly missing; explain any change in the PR.

## 1. Seller navigation

- Add a seller sub-nav (layout at `src/app/seller/layout.tsx`): لوحة التحكم (`/seller`), المنتجات (`/seller/products`), بيانات المتجر (move the store profile form to `/seller/settings`).
- If `seller.kycStatus !== "APPROVED"`, product pages show the KYC banner and a link to `/seller/kyc` instead of the forms. Server actions must also reject unapproved sellers.

## 2. Product list `/seller/products`

Table of the seller's products: title, category, price, status badge (مسودة / قيد المراجعة / نشط / مرفوض / موقوف), available stock (for `UNIQUE_CODES`), sold count, and an ON/OFF toggle for `salesEnabled`.

Buttons: "إضافة منتج", per-row "تعديل", "نسخ" (clone: copies product, options, quantity discounts, NOT stock; new copy is `DRAFT`), and a bulk "إيقاف كل المبيعات" that sets `salesEnabled=false` on all the seller's products.

## 3. Create / edit `/seller/products/new` and `/seller/products/[id]`

Fields: title, category (select, subcategories included), description (textarea), image URL (optional for now), price (EGP input, stored in piasters), compare-at price (optional, must be > price), delivery type (radio with the 4 types and an Arabic explanation each), min/max quantity, instructions shown to the buyer after purchase.

- `FILE` / `TEXT` / `LINK`: a `deliveryContent` field (for `FILE`, upload through `savePrivateFile` under `products/<sellerId>/` and store the key; allow zip/pdf/images, raise the limit to 50 MB for this folder only).
- Options editor: add/remove options; each option has a name, kind (`select` or `text`), required flag, and for `select` a list of values with label + price delta (EGP, may be negative but final price must stay ≥ 1 EGP).
- Quantity discounts editor: rows of min quantity + percent off (1–90), unique min quantity.
- Slug: `slugify(title)` plus `uniqueSuffix()` when taken.
- Saving has two buttons: "حفظ كمسودة" (`DRAFT`) and "إرسال للمراجعة" (`PENDING_REVIEW`). Editing an `ACTIVE` product's title, description, price, or delivery content sends it back to `PENDING_REVIEW`.
- Enforce `SELLER_TIERS[seller.type].maxActiveProducts` when submitting for review (count ACTIVE + PENDING_REVIEW).

## 4. Stock codes (UNIQUE_CODES only) `/seller/products/[id]/stock`

- Textarea "كود في كل سطر" and a `.txt` upload; trim lines, drop empty lines and duplicates (within the upload and against existing AVAILABLE stock for the product). Show "اتضاف X، اتشال Y مكرر".
- List AVAILABLE codes masked (first 4 chars + ••••) with delete per row; SOLD codes are listed read-only with sold date. Never render full codes outside this page.

## 5. Admin product review `/admin/products`

- Queue of `PENDING_REVIEW` products (oldest first) with seller name and tier.
- Review page shows everything the buyer will see plus delivery type and stock count (not the codes). Approve → `ACTIVE`; reject → `REJECTED` with a required `reviewNote` that the seller sees on the edit page.
- Add the link to the admin nav and a pending count on `/admin`.

## 6. Storefront updates

- Product page: compute the displayed price from the selected option values on the client (small client component); show the quantity selector within min/max and the quantity discount that applies. Keep the buy button disabled with "الشراء هيتفعّل قريب".
- Only `ACTIVE && salesEnabled` products appear anywhere public (already true; keep it).

## Acceptance checklist (put the results in the PR body)

- [ ] Unapproved seller cannot open the product form or call the actions.
- [ ] Seller A cannot edit, clone, or see stock of seller B's product (try by changing the id in the URL).
- [ ] Create a `UNIQUE_CODES` product with an option and a quantity discount, upload 10 codes with 2 duplicates → 8 added.
- [ ] Submit for review → admin approves → product shows on home and category page with correct price.
- [ ] Admin rejects another product with a note → seller sees the note.
- [ ] Editing an active product's price sends it back to review.
- [ ] Individual seller is blocked past the active product limit (temporarily lower it to test).
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` pass.
