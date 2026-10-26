# Phase 6: launch readiness (hosting, R2 storage, background jobs, Telegram, CI, hardening)

Branch: `phase-6-launch` → PR into `main`. Start only after phase 5 is merged.

Goal: the site can run in production on Vercel with a managed PostgreSQL database and Cloudflare R2, background work runs on a schedule, sellers get Telegram notifications, every PR is checked by CI, and the obvious production gaps (login brute force, password reset, security headers) are closed. Read `AGENTS.md` first; every rule there applies.

Out of scope: going live with real money (the owner does that by hand after this phase, see section 9), paid ads, pre-sale product questions, mobile apps.

Never commit real secrets. Every new setting goes into `.env.example` with an empty value and a one-line comment, and is validated at startup like `paymentConfig()`.

## 1. Test isolation and CI

1. Change the `test:integration` script to run files one after another: add `--test-concurrency=1`. The test files share one database and race (`releaseExpiredOrders` uses `SKIP LOCKED`).
2. Add `.github/workflows/ci.yml`: on `pull_request` and push to `main`, Node 22, a `postgres:16` service, `npm ci`, `npx prisma migrate deploy` on a fresh test database, then `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:integration`, `npm run build`. Use dummy env values; never real keys. Cache npm.

## 2. Database in production

1. Support a pooled connection for the app and a direct one for migrations: `DATABASE_URL` (pooled, e.g. Neon pooler) and `DIRECT_URL` (direct) via `directUrl = env("DIRECT_URL")` in `schema.prisma`. Local dev may set both to the same value.
2. All interactive transactions already used must keep working through the pooler (they use row locks and `pg_advisory_xact_lock`, which are transaction-scoped and safe in transaction pooling). Do not add session-level advisory locks or `SET` statements.
3. README: a "Production database" section: create the database, set both URLs, run `npx prisma migrate deploy` before each deploy, turn on point-in-time recovery / daily backups.

## 3. Cloudflare R2 storage

Keep the public interface of `src/lib/storage.ts` (`savePrivateFile`, `readPrivateFile`, `deletePrivateFile`) and add a driver chosen by `STORAGE_DRIVER=local|r2` (default `local`; `r2` required when `NODE_ENV=production`).

1. R2 driver with `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`). The bucket is private; no public access, no public URLs anywhere.
2. Keys keep the same shape (`kyc/...`, `products/<sellerId>/...`, `chat/<orderId>/...`), and `resolveKey`-style validation stays: reject `..`, absolute paths and unknown prefixes before any call.
3. **Large uploads.** Vercel functions reject request bodies over about 4.5 MB, so product delivery files (up to 50 MB) must upload straight to R2:
   - Server action `createUploadUrl(kind, size, type)` checks the session, ownership and the limits per kind (product file: zip/pdf/image ≤ 50 MB for the seller's own product; KYC and chat images keep their current limits), creates a key under `pending/<userId>/<uuid>.<ext>` and returns a presigned PUT URL valid for 5 minutes with `ContentType` and `ContentLength` fixed in the signature.
   - The browser uploads with `fetch(PUT)`, then submits the form with the pending key.
   - The server action that saves the product (or KYC / message) accepts only a pending key that starts with `pending/<session userId>/`, `HeadObject`s it to confirm size and type, reads the first 16 bytes to check the magic bytes (zip `PK\x03\x04`, pdf `%PDF`, jpeg, png, webp), copies it to its final key, deletes the pending object, and only then writes the DB row. On any failure it deletes what it created.
   - An R2 lifecycle rule deletes `pending/` objects after 1 day (document it in the README).
   - With `STORAGE_DRIVER=local` the current form upload keeps working, so local development doesn't need R2.
4. **Downloads.** Keep every existing auth check, then instead of streaming bytes through the function, redirect (302) to a presigned GET valid for 60 seconds with `ResponseContentDisposition=attachment` (or `inline` for chat images) and `ResponseCacheControl=private, no-store`. Never log or store the presigned URL.
5. Unit test key validation; integration-test the upload flow against a fake S3 client injected into the driver (no network in tests).

## 4. Background jobs

1. Route `GET /api/cron/[job]` (Vercel Cron sends GET requests with this header) protected by `Authorization: Bearer ${CRON_SECRET}` compared with `timingSafeEqual`; 404 for unknown jobs, 401 for a bad secret.
2. Jobs:
   - `release-expired-orders`: calls `releaseExpiredOrders()` (every 5 minutes).
   - `send-notifications`: sends pending notifications (every minute, see section 5).
   - `cleanup`: deletes `OrderRead` rows for orders older than 180 days and expired password-reset tokens (daily).
3. `vercel.json` with the cron schedule. Each job is idempotent and finishes in under 30 seconds (process in batches of 100, stop early when the time budget is used).
4. Keep the existing on-request `releaseExpiredOrders()` calls; the cron is a safety net.

## 5. Telegram notifications for sellers

The current free-text "@username" field can't receive bot messages; Telegram only allows messaging a chat that started the bot. Replace it with a link flow.

1. Settings: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`. If they're empty, the feature is hidden and nothing breaks.
2. Schema (migration `launch`): on `SellerProfile` replace the use of `telegramChatId` with a verified one: `telegramChatId String?` (now only set by the webhook), `telegramLinkedAt DateTime?`; new model `TelegramLinkToken { token String @id, sellerId String, expiresAt DateTime, usedAt DateTime? }`; new model `Notification { id, sellerId, channel "TELEGRAM", event String, payload String (JSON, no secrets), status PENDING|SENT|FAILED, attempts Int @default(0), nextAttemptAt DateTime @default(now()), lastError String?, createdAt, sentAt DateTime? }` with `@@index([status, nextAttemptAt])`. Clear existing free-text `telegramChatId` values in the migration (they were never verified).
3. Seller settings page: button "اربط تليجرام" creates a random 32-byte token (expires in 15 minutes) and shows the link `https://t.me/<bot>?start=<token>`; "إلغاء الربط" clears the chat id.
4. Webhook `POST /api/telegram/webhook`: reject unless the `X-Telegram-Bot-Api-Secret-Token` header equals `TELEGRAM_WEBHOOK_SECRET` (timing-safe). Handle only `/start <token>` from private chats: if the token exists, isn't used or expired, set the seller's `telegramChatId` and `telegramLinkedAt`, mark the token used, reply "تم ربط متجرك ✅". Always return 200 for valid-secret requests; ignore everything else.
5. Events (create the `Notification` row inside the same transaction as the event, only if the seller is linked): new paid sale (order number, product title, amount), new chat message from a buyer (no message text, just "رسالة جديدة على طلب #N"), dispute opened, dispute resolved, payout paid / rejected, product approved / rejected, stock of a UNIQUE_CODES product drops to 3 or fewer. Never include codes, delivered content, buyer email/phone or full payout accounts.
6. Sender (cron job): pick up to 100 `PENDING` rows with `nextAttemptAt <= now` using `FOR UPDATE SKIP LOCKED`, call `sendMessage` with a 10 s timeout, mark `SENT`; on error increase `attempts`, back off (1, 5, 30, 120 minutes), mark `FAILED` after 5 attempts; on Telegram 403 (bot blocked) clear the seller's chat id and mark `FAILED`. Messages in Arabic with a link to the relevant seller page (`APP_URL`).
7. Tests: webhook secret check, token single-use and expiry, notification rows created in the event transactions, sender back-off with a fake fetch.

## 6. Accounts: login protection and password reset

1. Login rate limit stored in the DB (`LoginAttempt { id, key String, createdAt }`, index on `[key, createdAt]`): max 5 failed attempts per email per 15 minutes and 20 per IP per 15 minutes (IP from `x-forwarded-for` first value on Vercel). Over the limit: generic Arabic message "محاولات كتير، جرّب بعد شوية" without saying whether the email exists. Clear the email's attempts on success.
2. Password reset by email with Resend (`RESEND_API_KEY`, `EMAIL_FROM`; hidden when not set; in development log the link to the server console instead of sending):
   - "نسيت الباسورد" page asks for the email and always answers "لو الإيميل مسجل هيوصلك لينك".
   - Token: 32 random bytes, store only its SHA-256 hash (`PasswordResetToken { id, userId, tokenHash @unique, expiresAt, usedAt? }`), valid 30 minutes, single use, max 3 requests per email per hour.
   - Reset page sets a new password (min 8 chars), marks the token used, deletes the user's other reset tokens, and invalidates existing sessions: add `sessionVersion Int @default(0)` to `User`, put it in the JWT, bump it on reset and on password change, and reject tokens whose version doesn't match in `getCurrentUser()`.
   - A changed payout destination already needs the password; a password reset must also restart the 24-hour payout lock (set `payoutUpdatedAt = now` when the seller has a destination).
3. Tests for the limiter, token hashing, expiry, single use and session invalidation.

## 7. Security headers and production checks

1. `next.config.ts` headers for all routes: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (production only), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and a Content-Security-Policy that allows self, Google Fonts, the Paymob checkout domain (`accept.paymob.com`) and the R2 presigned host for images; no `unsafe-eval` in production.
2. Session cookie: `Secure` in production, `HttpOnly`, `SameSite=Lax` (check what's there and fix if needed).
3. Startup validation (`instrumentation.ts`): in production fail fast if `AUTH_SECRET` is shorter than 32 chars, `APP_URL` isn't https, `STORAGE_DRIVER` isn't `r2`, `CRON_SECRET` is missing, or the payment config is incomplete.
4. `GET /api/health` returns `{ ok: true }` after a `SELECT 1`; no version or env details.
5. Error logging: keep `console.error` but never log secrets, codes, tokens, presigned URLs or full card / account numbers. Grep the codebase for existing logs that break this and fix them.

## 8. Tests summary

`npm test`, `npm run test:integration` (now serial), `npx tsc --noEmit`, `npm run lint`, `npm run build` must pass locally and in the new CI workflow on the PR.

## 9. README: launch runbook (the owner follows this by hand)

Write a numbered Arabic + English checklist in the README:
1. Create the Neon (or Supabase) database, set `DATABASE_URL` / `DIRECT_URL`, run `npx prisma migrate deploy`.
2. Create the R2 bucket (private), API token with access to that bucket only, lifecycle rule for `pending/`.
3. Create the Vercel project from the repo, set every env var from `.env.example`, set `PAYMENT_PROVIDER=paymob` with Paymob **test** keys first.
4. Set the Paymob callback URLs: transaction processed callback → `<APP_URL>/api/payments/paymob/webhook`, response callback → `<APP_URL>/api/payments/paymob/return`.
5. Create the Telegram bot with BotFather, then call `setWebhook` with `url=<APP_URL>/api/telegram/webhook` and `secret_token=<TELEGRAM_WEBHOOK_SECRET>`.
6. Verify the domain in Resend and set `EMAIL_FROM`.
7. Smoke test on the deployed site with Paymob test cards: buy a code product, a file product, check delivery, chat, a review, a dispute, a payout request, a Telegram notification and a password reset.
8. Only after all of that passes: switch to Paymob live keys and make one small real purchase, then refund it from the Paymob dashboard and record the refund in admin.

## Acceptance checklist (put results in the PR body)

- [ ] CI workflow runs on the PR and is green.
- [ ] With `STORAGE_DRIVER=local` everything works as before; with the fake S3 client the presigned upload / download flow passes its tests.
- [ ] A 40 MB zip uploads as a product delivery file through the presigned flow (tested against a real or MinIO bucket if available; say which in the PR).
- [ ] Cron routes reject a wrong secret and run with the right one.
- [ ] Telegram link flow and one notification work with a test bot (or with the fake fetch if no bot; say which).
- [ ] 6th wrong password for an email within 15 minutes is refused; password reset works once and logs out other sessions.
- [ ] Security headers present on `/` and on a download response.
