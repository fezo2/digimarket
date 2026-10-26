# Agent guide for ديجي مصر (Digiegy)

Multi-vendor marketplace for digital products in Egypt. Read `README.md` first.

## Ground rules

- UI text is Egyptian Arabic, layout is RTL (`<html dir="rtl">`). Use logical Tailwind classes (`ms-`, `me-`, `ps-`, `start-`, `end-`), never `ml-`/`mr-`/`left-`/`right-`.
- Reuse the utilities in `src/app/globals.css`: `card`, `btn-primary`, `btn-outline`, `btn-danger`, `input`, `label`, `badge`.
- Money is integer piasters everywhere (`Int`). Format with `formatEGP` and parse user input with `toPiasters` from `src/lib/money.ts`. Never use floats for stored money.
- Commission rates are basis points (`commissionBps`, 1000 = 10%). Copy the rate onto the order item at purchase time; never recompute old orders from the current category rate.
- Seller balance comes only from `LedgerEntry` rows (`src/lib/ledger.ts`). Never store a balance column.
- Mutations are Server Actions in an `actions.ts` next to the route, validated with `zod`, and must start with `requireUser` / `requireSeller` / `requireAdmin` from `src/lib/auth.ts`. Check ownership (e.g. `product.sellerId === seller.id`) before every update or delete.
- Client forms use `useActionState` and return `{ error?: string }` (see `src/app/seller/join/join-form.tsx`).
- Private files (KYC documents, product files) go through `src/lib/storage.ts`, never `public/`.
- Secret content (stock codes, `deliveryContent`) must never be sent to a page unless the viewer is the owning seller, an admin, or a buyer of a paid order item that contains it.
- Schema changes: edit `prisma/schema.prisma`, then `npx prisma migrate dev --name <change>` and commit the migration folder.

## Before opening a PR

Run and make sure all pass:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Then start the app against a seeded database and click through the flow you changed. Describe what you tested in the PR body.

## Workflow

- One task file in `docs/tasks/` = one branch = one PR into `main`.
- Keep PRs to the task's scope. List anything you skipped or were unsure about in the PR body.
