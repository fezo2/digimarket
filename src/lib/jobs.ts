import "server-only";
import { db } from "./db";
import { releaseExpiredOrders } from "./orders";
import { sendNotifications } from "./notifications";
import { secretMatches } from "./security";
export const jobs = [
  "release-expired-orders",
  "send-notifications",
  "cleanup",
  "supplier-sync",
] as const;
export function cronAuthorization(job: string, header: string | null) {
  if (!jobs.includes(job as (typeof jobs)[number])) return 404;
  return secretMatches(
    header,
    process.env.CRON_SECRET ? "Bearer " + process.env.CRON_SECRET : undefined,
  )
    ? 200
    : 401;
}
export async function cleanupBatch() {
  return db.$transaction(
    async (tx) => {
      const reads =
        await tx.$executeRaw`DELETE FROM "OrderRead" WHERE ("orderId","userId") IN (SELECT r."orderId",r."userId" FROM "OrderRead" r JOIN "Order" o ON o.id=r."orderId" WHERE o."createdAt" < (NOW() AT TIME ZONE 'UTC') - INTERVAL '180 days' LIMIT 100)`;
      const tokens =
        await tx.$executeRaw`DELETE FROM "PasswordResetToken" WHERE id IN (SELECT id FROM "PasswordResetToken" WHERE "expiresAt" < (NOW() AT TIME ZONE 'UTC') LIMIT 100)`;
      await tx.$executeRaw`DELETE FROM "EmailVerificationToken" WHERE id IN (SELECT id FROM "EmailVerificationToken" WHERE "expiresAt" < (NOW() AT TIME ZONE 'UTC') LIMIT 100)`;
      await tx.$executeRaw`DELETE FROM "PendingSignup" WHERE id IN (SELECT id FROM "PendingSignup" WHERE "expiresAt" < (NOW() AT TIME ZONE 'UTC') LIMIT 100)`;
      await tx.$executeRaw`DELETE FROM "LoginAttempt" WHERE id IN (SELECT id FROM "LoginAttempt" WHERE "createdAt" < (NOW() AT TIME ZONE 'UTC') - INTERVAL '1 day' LIMIT 100)`;
      await tx.$executeRaw`DELETE FROM "TelegramLinkToken" WHERE token IN (SELECT token FROM "TelegramLinkToken" WHERE "expiresAt" < (NOW() AT TIME ZONE 'UTC') LIMIT 100)`;
      return reads + tokens;
    },
    { timeout: 4000, maxWait: 1000 },
  );
}
export async function runJob(job: string) {
  if (job === "send-notifications") return sendNotifications();
  if (job === "supplier-sync")
    return (await import("./supplier")).runSupplierJob();
  const deadline = Date.now() + 25000;
  let total = 0;
  while (Date.now() + 7000 < deadline) {
    const count =
      job === "cleanup" ? await cleanupBatch() : await releaseExpiredOrders();
    total += count;
    if (!count) break;
  }
  return total;
}
